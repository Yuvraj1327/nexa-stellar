"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWalletStore } from "@/lib/wallet-store";
import { parseStellarError } from "@/lib/stellar-utils";
import { CONTRACT_CONFIG } from "@/lib/contract-config";

type Kit = {
  openModal: (opts: { onWalletSelected: (opt: { id: string }) => void }) => void;
  setWallet: (id: string) => void;
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
  const kitRef = useRef<Kit | null>(null);

  // ─── Init StellarWalletsKit ───────────────────────────────────────────────

  const initKit = useCallback(async (): Promise<Kit | null> => {
    if (typeof window === "undefined") return null;

    // Re-use existing kit instance
    if (kitRef.current) return kitRef.current;

    try {
      const {
        StellarWalletsKit,
        WalletNetwork,
        FREIGHTER_ID,
        FreighterModule,
        xBullModule,
        AlbedoModule,
        LobstrModule,
      } = await import("@creit.tech/stellar-wallets-kit");

      const network =
        CONTRACT_CONFIG.network === "mainnet"
          ? WalletNetwork.PUBLIC
          : WalletNetwork.TESTNET;

      const kit = new StellarWalletsKit({
        network,
        selectedWalletId: FREIGHTER_ID,
        modules: [
          new FreighterModule(),
          new xBullModule(),
          new AlbedoModule(),
          new LobstrModule(),
        ],
      });

      kitRef.current = kit as unknown as Kit;
      store.setKit(kit);
      return kitRef.current;
    } catch (err) {
      console.error("StellarWalletsKit init failed:", err);
      // Fallback: try allowAllModules
      try {
        const { StellarWalletsKit, WalletNetwork, FREIGHTER_ID, allowAllModules } =
          await import("@creit.tech/stellar-wallets-kit");
        const network =
          CONTRACT_CONFIG.network === "mainnet"
            ? WalletNetwork.PUBLIC
            : WalletNetwork.TESTNET;
        const kit = new StellarWalletsKit({
          network,
          selectedWalletId: FREIGHTER_ID,
          modules: allowAllModules(),
        });
        kitRef.current = kit as unknown as Kit;
        store.setKit(kit);
        return kitRef.current;
      } catch {
        store.setError("Failed to load wallet library. Please refresh the page.");
        return null;
      }
    }
  }, [store]);

  // ─── Connect ─────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    store.setConnecting(true);
    store.setError(null);

    try {
      const kit = await initKit();
      if (!kit) throw new Error("Wallet library could not be loaded");

      await new Promise<void>((resolve, reject) => {
        kit.openModal({
          onWalletSelected: async (opt: { id: string }) => {
            try {
              kit.setWallet(opt.id);

              // Freighter needs a brief delay after setWallet
              await new Promise((r) => setTimeout(r, 400));

              const { address } = await kit.getAddress();

              if (!address) {
                throw new Error("Wallet returned no address");
              }

              store.setAddress(address);
              resolve();
            } catch (err: unknown) {
              const msg = String((err as Error)?.message ?? err ?? "").toLowerCase();

              if (
                msg.includes("not installed") ||
                msg.includes("not found") ||
                msg.includes("is not available") ||
                msg.includes("undefined") ||
                msg.includes("extension")
              ) {
                reject(
                  new Error(
                    "Wallet extension not installed. Please install Freighter from freighter.app and try again.",
                  ),
                );
              } else if (
                msg.includes("reject") ||
                msg.includes("declined") ||
                msg.includes("denied") ||
                msg.includes("cancel") ||
                msg.includes("user refused")
              ) {
                reject(
                  new Error(
                    "Connection rejected. Please approve the connection request in your wallet.",
                  ),
                );
              } else {
                reject(new Error((err as Error)?.message || "Failed to connect wallet"));
              }
            }
          },
        });

        // Safety timeout
        setTimeout(
          () => reject(new Error("Connection timed out. Please try again.")),
          120_000,
        );
      });
    } catch (err: unknown) {
      store.setError(parseStellarError(err));
    } finally {
      store.setConnecting(false);
    }
  }, [initKit, store]);

  // ─── Disconnect ───────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    try {
      kitRef.current?.disconnect();
    } catch {}
    kitRef.current = null;
    store.disconnect();
  }, [store]);

  // ─── Sign Transaction ─────────────────────────────────────────────────────

  const signTransaction = useCallback(
    async (txXdr: string): Promise<string> => {
      // Try to re-init kit if lost (e.g. page refresh with persisted address)
      if (!kitRef.current) {
        await initKit();
      }

      const kit = kitRef.current;
      if (!kit) throw new Error("Wallet not connected. Please connect your wallet first.");
      if (!store.address) throw new Error("No wallet address. Please reconnect your wallet.");

      try {
        const result = await kit.sign({
          blob: txXdr,
          publicKey: store.address,
          networkPassphrase: CONTRACT_CONFIG.networkPassphrase,
        });

        if (!result?.signedTxXdr) {
          throw new Error("Wallet returned an empty signature. Please try again.");
        }

        return result.signedTxXdr;
      } catch (err: unknown) {
        const msg = String((err as Error)?.message ?? err ?? "").toLowerCase();

        if (
          msg.includes("reject") ||
          msg.includes("declined") ||
          msg.includes("denied") ||
          msg.includes("cancel") ||
          msg.includes("user refused")
        ) {
          throw new Error(
            "Transaction rejected. You declined the signing request in your wallet.",
          );
        }

        if (msg.includes("not installed") || msg.includes("not found")) {
          throw new Error(
            "Wallet extension not found. Please ensure Freighter is installed and unlocked.",
          );
        }

        // Insufficient balance — Freighter sometimes surfaces this
        if (msg.includes("insufficient") || msg.includes("underfunded")) {
          throw new Error(
            "Insufficient XLM balance. You need enough XLM to cover the transaction fee.",
          );
        }

        throw err;
      }
    },
    [store.address, initKit],
  );

  // ─── Reconnect on mount if address persisted ──────────────────────────────

  useEffect(() => {
    if (store.address) {
      store.refreshBalances();
      // Silently try to reinit kit for signing capability
      initKit().catch(() => {});
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
