"use client";

import { useToastStore } from "@/hooks/use-toast";
import { explorerTxUrl } from "@/lib/stellar-utils";
import type { ToastMessage } from "@/types";

function Toast({ toast }: { toast: ToastMessage }) {
  const { removeToast } = useToastStore();

  const colors = {
    default: "border-white/10 bg-[#0d0f16]",
    destructive: "border-red-500/30 bg-red-950/80",
    success: "border-green-500/30 bg-green-950/80",
  };

  const iconMap = {
    default: "💫",
    destructive: "❌",
    success: "✅",
  };

  return (
    <div
      className={`flex items-start gap-3 w-80 max-w-full p-4 rounded-xl border shadow-2xl backdrop-blur ${colors[toast.variant ?? "default"]} animate-in slide-in-from-right-full`}
    >
      <span className="text-lg shrink-0">{iconMap[toast.variant ?? "default"]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-white/60 mt-0.5">{toast.description}</p>
        )}
        {toast.txHash && (
          <a
            href={explorerTxUrl(toast.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-stellar-blue hover:underline mt-1 inline-flex items-center gap-1"
          >
            View transaction ↗
          </a>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-white/30 hover:text-white shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}
