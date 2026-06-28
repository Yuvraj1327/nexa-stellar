"use client";

import { create } from "zustand";
import type { ToastMessage } from "@/types";
import { generateId } from "@/lib/stellar-utils";

interface ToastStore {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = generateId();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 6000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const { addToast } = useToastStore();

  const toast = (opts: {
    title: string;
    description?: string;
    variant?: "default" | "destructive" | "success";
    txHash?: string;
  }) => {
    addToast({
      title: opts.title,
      description: opts.description,
      variant: opts.variant ?? "default",
      txHash: opts.txHash,
    });
  };

  return { toast };
}
