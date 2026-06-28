import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Transaction, TxStatus, TxType } from "@/types";
import { generateId } from "@/lib/stellar-utils";

interface TxStore {
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, "id" | "timestamp">) => string;
  updateTransaction: (id: string, update: Partial<Transaction>) => void;
  clearAll: () => void;
}

export const useTxStore = create<TxStore>()(
  persist(
    (set, get) => ({
      transactions: [],

      addTransaction: (tx) => {
        const id = generateId();
        const newTx: Transaction = {
          ...tx,
          id,
          timestamp: Date.now(),
        };
        set((s) => ({ transactions: [newTx, ...s.transactions].slice(0, 50) }));
        return id;
      },

      updateTransaction: (id, update) => {
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, ...update } : t,
          ),
        }));
      },

      clearAll: () => set({ transactions: [] }),
    }),
    {
      name: "nexa-transactions",
      partialize: (s) => ({ transactions: s.transactions }),
    },
  ),
);
