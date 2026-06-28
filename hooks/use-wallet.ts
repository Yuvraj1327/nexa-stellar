"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWalletStore } from "@/lib/wallet-store";
import { parseStellarError } from "@/lib/stellar-utils";
import { CONTRACT_CONFIG } from "@/lib/contract-config";

// StellarWalletsKit types (dynamic import to avoid SSR issues)
type StellarWalletsKit = {
  openModal: (opts: { onWalletSelected: (option: { id: string }) => void }) => void;
  setWallet: (walletId: string) => void;
  getAddress: () => Promise<{ address: string }>;
  sign: (opts: {
    blob: string;
    publicKey: string;
    networkPassphrase: string;
  }) => Promise<{ signedTxXdr: string }>;
  disconnect: () => void;
};

export function useWallet() {
  const store = useWalletStore();
  const kitRef = useRef<StellarWalletsKit | null>(null);

  // ─── Initialize StellarWalletsKit (lazy, client-only) ────────────────────
  const initKit = useCallback(async () => {
    if (typeof window === "undefined") return null;
    if (kitRef.current) return kitRef.current;

    try {
      const {
        StellarWalletsKit,
        WalletNetwork,
        FREIGHTER_ID,
        allowAllModules,
      } = await import("@creit.tech/stellar-wallets-kit");

      const network =
        CONTRACT_CONFIG.network === "mainnet"
          ? WalletNetwork.PUBLIC
          : WalletNetwork.TESTNET;

      const kit = new StellarWalletsKit({
        network,
        selectedWalletId: FREIGHTER_ID,
        modules: allowAllModules(),
      });

      kitRef.current = kit as unknown as StellarWalletsKit;
      store.setKit(kit);
      return kit as unknown as StellarWalletsKit;
    } catch (err) {
      console.error("Failed to initialize StellarWalletsKit:", err);
      store.setError(
        "Failed to load wallet library. Please refresh and try again.",
      );
      return null;
    }
  }, [store]);

  // ─── Connect ─────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    store.setConnecting(true);
    store.setError(null);

    try {
      const kit = await initKit();
      if (!kit) throw new Error("Could not initialize wallet library");

      await new Promise<void>((resolve, reject) => {
        try {
          kit.openModal({
            onWalletSelected: async (option: { id: string }) => {
              try {
                kit.setWallet(option.id);
                const { address } = await kit.getAddress();
                if (!address) throw new Error("No address returned from wallet");
                store.setAddress(address);
                resolve();
              } catch (err: unknown) {
                const msg = String((err as Error)?.message ?? err ?? "");
                // Wallet not installed
                if (
                  msg.toLowerCase().includes("not installed") ||
                  msg.toLowerCase().includes("not found") ||
                  msg.toLowerCase().includes("is not available")
                ) {
                  reject(
                    new Error(
                      "Wallet extension not installed. Please install Freighter or another Stellar wallet.",
                    ),
                  );
                }
                // User rejected
                else if (
                  msg.toLowerCase().includes("reject") ||
                  msg.toLowerCase().includes("declined") ||
                  msg.toLowerCase().includes("denied") ||
                  msg.toLowerCase().includes("cancelled")
                ) {
                  reject(new Error("Connection rejected. Please approve the connection in your wallet."));
                } else {
                  reject(err);
                }
              }
            },
          });
        } catch (err: unknown) {
          reject(err);
        }

        // Safety timeout — don't hang forever
        setTimeout(
          () => reject(new Error("Wallet selection timed out. Please try again.")),
          120_000,
        );
      });
    } catch (err: unknown) {
      const msg = parseStellarError(err);
      store.setError(msg);
    } finally {
      store.setConnecting(false);
    }
  }, [initKit, store]);

  // ─── Disconnect ───────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    try {
      kitRef.current?.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    kitRef.current = null;
    store.disconnect();
  }, [store]);

  // ─── Sign Transaction ─────────────────────────────────────────────────────
  const signTransaction = useCallback(
    async (txXdr: string): Promise<string> => {
      const kit = kitRef.current;
      if (!kit) throw new Error("Wallet not connected. Please connect first.");
      if (!store.address) throw new Error("No wallet address found.");

      try {
        const result = await kit.sign({
          blob: txXdr,
          publicKey: store.address,
          networkPassphrase: CONTRACT_CONFIG.networkPassphrase,
        });

        if (!result?.signedTxXdr) {
          throw new Error("Wallet returned an empty signature.");
        }

        return result.signedTxXdr;
      } catch (err: unknown) {
        const msg = String((err as Error)?.message ?? err ?? "");
        // Explicit user rejection handling
        if (
          msg.toLowerCase().includes("reject") ||
          msg.toLowerCase().includes("declined") ||
          msg.toLowerCase().includes("denied") ||
          msg.toLowerCase().includes("user cancel") ||
          msg.toLowerCase().includes("cancelled")
        ) {
          throw new Error("Transaction rejected by wallet. Please approve in your wallet to continue.");
        }
        // Wallet not installed / extension gone
        if (
          msg.toLowerCase().includes("not installed") ||
          msg.toLowerCase().includes("not found")
        ) {
          throw new Error("Wallet extension not found. Please ensure your wallet is installed and unlocked.");
        }
        throw err;
      }
    },
    [store.address],
  );

  // ─── Session Restore ──────────────────────────────────────────────────────
  useEffect(() => {
    if (store.address) {
      store.refreshBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    address: store.address,
    isConnected: store.isConnected,
    isConnecting: store.isConnecting,
    balances: store.balances,
    error: store.error,
    network: store.network,
    connect,
    disconnect,
    signTransaction,
    refreshBalances: store.refreshBalances,
  };
}
