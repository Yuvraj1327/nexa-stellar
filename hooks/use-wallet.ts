"use client";

/**
 * use-wallet.ts
 *
 * Verified against @creit.tech/stellar-wallets-kit@0.9.2 API:
 *
 * - openModal(params) → Promise<void>  (awaitable; fires onWalletSelected cb after user picks)
 * - setWallet(id)     → void
 * - getPublicKey()    → Promise<string>          ← NOT getAddress()
 * - signTx(params)    → Promise<{ result: string }> ← result is signed XDR
 * - sign(params)      → Promise<{ signedXDR: string }> (deprecated, kept as fallback)
 * - onClosed(err)     → called when modal is dismissed without selecting → must reject
 */

import { useCallback, useEffect, useRef } from "react";
import { useWalletStore } from "@/lib/wallet-store";
import { parseStellarError } from "@/lib/stellar-utils";
import { CONTRACT_CONFIG } from "@/lib/contract-config";

// ─── Exact v0.9.2 type surface ────────────────────────────────────────────────

type WalletOption = {
  id: string;
  name: string;
  isAvailable: boolean;
};

type Kit = {
  openModal(params: {
    onWalletSelected: (option: WalletOption) => void;
    onClosed?: (err: Error) => void;
    modalTitle?: string;
    notAvailableText?: string;
  }): Promise<void>;
  setWallet(id: string): void;
  getPublicKey(params?: { path?: string }): Promise<string>;
  signTx(params: {
    xdr: string;
    publicKeys: string[];
    network: string;
  }): Promise<{ result: string }>;
  /** @deprecated kept for fallback */
  sign(params: {
    blob?: string;
    xdr?: string;
    publicKey?: string;
    network?: string;
  }): Promise<{ signedXDR: string }>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const store = useWalletStore();
  const kitRef = useRef<Kit | null>(null);

  // ── Init StellarWalletsKit (client-side only) ─────────────────────────────

  const initKit = useCallback(async (): Promise<Kit | null> => {
    if (typeof window === "undefined") return null;
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
      return kitRef.current;
    } catch (err) {
      console.error("[Nexa] StellarWalletsKit init failed:", err);
      // Fallback: allowAllModules (some environments need this)
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
        kitRef.current = kit as unknown as Kit;
        return kitRef.current;
      } catch (fallbackErr) {
        console.error("[Nexa] Kit fallback also failed:", fallbackErr);
        return null;
      }
    }
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    store.setConnecting(true);
    store.setError(null);

    try {
      const kit = await initKit();
      if (!kit) {
        throw new Error(
          "Could not load wallet library. Please refresh the page and try again.",
        );
      }

      // openModal is async and fires onWalletSelected after the user picks.
      // onClosed fires if the user dismisses the modal without picking.
      // We wrap the whole flow in a Promise so connect() is awaitable.

      await new Promise<void>((resolve, reject) => {
        kit
          .openModal({
            onWalletSelected: async (option: WalletOption) => {
              try {
                // 1. Tell the kit which wallet was selected
                kit.setWallet(option.id);

                // 2. Freighter (and some others) need a brief moment after
                //    setWallet before getPublicKey works reliably
                await new Promise((r) => setTimeout(r, 300));

                // 3. Get the connected address — v0.9.2 API is getPublicKey()
                const address = await kit.getPublicKey();

                if (!address || typeof address !== "string" || address.length < 10) {
                  throw new Error(
                    "Wallet returned an invalid address. Please unlock your wallet and try again.",
                  );
                }

                // 4. Persist to store
                store.setAddress(address);
                resolve();
              } catch (err: unknown) {
                reject(classifyWalletError(err));
              }
            },

            // User closed the modal without picking a wallet
            onClosed: (err: Error) => {
              // err is provided by the kit; it may be null/undefined when user
              // simply clicks outside the modal
              reject(
                new Error(
                  err?.message && !err.message.includes("closed")
                    ? err.message
                    : "Wallet selection cancelled.",
                ),
              );
            },
          })
          .catch((err: unknown) => {
            // openModal itself can reject (e.g. if modal can't be mounted)
            reject(classifyWalletError(err));
          });
      });
    } catch (err: unknown) {
      store.setError(parseStellarError(err));
    } finally {
      store.setConnecting(false);
    }
  }, [initKit, store]);

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    kitRef.current = null;
    store.disconnect();
  }, [store]);

  // ── Sign Transaction ──────────────────────────────────────────────────────

  const signTransaction = useCallback(
    async (txXdr: string): Promise<string> => {
      // Attempt to re-init kit if the page was refreshed
      if (!kitRef.current) {
        await initKit();
      }

      const kit = kitRef.current;
      if (!kit) {
        throw new Error(
          "Wallet not connected. Please connect your wallet first.",
        );
      }
      if (!store.address) {
        throw new Error(
          "No wallet address found. Please reconnect your wallet.",
        );
      }

      try {
        // Use signTx (preferred over deprecated sign())
        // Returns: { result: string } where result is the signed XDR
        const { result } = await kit.signTx({
          xdr: txXdr,
          publicKeys: [store.address],
          network: CONTRACT_CONFIG.networkPassphrase,
        });

        if (!result) {
          throw new Error(
            "Wallet returned an empty signature. Please try again.",
          );
        }

        return result;
      } catch (err: unknown) {
        throw classifyWalletError(err);
      }
    },
    [store.address, initKit],
  );

  // ── Restore balance on mount if address persisted ─────────────────────────

  useEffect(() => {
    if (store.address) {
      store.refreshBalances();
      // Silently re-init kit so signing works after page refresh
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

// ─── Error Classifier ─────────────────────────────────────────────────────────

function classifyWalletError(err: unknown): Error {
  const msg = String(
    err instanceof Error ? err.message : err ?? "",
  ).toLowerCase();

  if (
    msg.includes("not installed") ||
    msg.includes("not found") ||
    msg.includes("is not available") ||
    msg.includes("failed to fetch") ||
    msg.includes("extension") ||
    msg.includes("cannot read") // Freighter not installed → JS error on its API
  ) {
    return new Error(
      "Wallet extension not installed. Please install Freighter from freighter.app, then refresh and try again.",
    );
  }

  if (
    msg.includes("reject") ||
    msg.includes("declined") ||
    msg.includes("denied") ||
    msg.includes("cancel") ||
    msg.includes("user refused") ||
    msg.includes("user did not") ||
    msg.includes("closed")
  ) {
    return new Error(
      "Connection request rejected. Please approve the request in your wallet.",
    );
  }

  if (msg.includes("insufficient") || msg.includes("underfunded")) {
    return new Error(
      "Insufficient XLM balance. You need XLM to cover the transaction fee.",
    );
  }

  if (msg.includes("network") || msg.includes("passphrase")) {
    return new Error(
      "Network mismatch. Please set your wallet to Stellar Testnet and try again.",
    );
  }

  return err instanceof Error
    ? err
    : new Error(String(err ?? "Unknown wallet error"));
}