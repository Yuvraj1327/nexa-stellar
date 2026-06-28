import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { WalletBalance, Network } from "@/types";
import { fetchXLMBalance } from "@/lib/soroban-client";
import { CONTRACT_CONFIG } from "@/lib/contract-config";

interface WalletStore {
  // State
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  network: Network;
  balances: WalletBalance[];
  kit: unknown | null;
  error: string | null;

  // Actions
  setAddress: (address: string | null) => void;
  setKit: (kit: unknown) => void;
  setConnecting: (v: boolean) => void;
  setError: (error: string | null) => void;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
}

export const useWalletStore = create<WalletStore>()(
  devtools(
    (set, get) => ({
      address: null,
      isConnected: false,
      isConnecting: false,
      network: CONTRACT_CONFIG.network as Network,
      balances: [],
      kit: null,
      error: null,

      setAddress: (address) => {
        set({ address, isConnected: !!address, error: null });
        if (address) get().refreshBalances();
      },

      setKit: (kit) => set({ kit }),

      setConnecting: (v) => set({ isConnecting: v }),

      setError: (error) => set({ error }),

      disconnect: () =>
        set({
          address: null,
          isConnected: false,
          balances: [],
          kit: null,
          error: null,
        }),

      refreshBalances: async () => {
        const { address } = get();
        if (!address) return;
        try {
          const balance = await fetchXLMBalance(address);
          set({
            balances: [
              {
                asset: "XLM",
                balance,
                decimals: 7,
              },
            ],
          });
        } catch {
          // Silently fail balance refresh
        }
      },
    }),
    { name: "nexa-wallet" },
  ),
);
