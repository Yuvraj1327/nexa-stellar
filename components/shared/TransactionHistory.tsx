"use client";

import { useTxStore } from "@/lib/tx-store";
import {
  explorerTxUrl,
  formatTimestamp,
  formatXLM,
  shortenAddress,
} from "@/lib/stellar-utils";
import type { Transaction, TxType } from "@/types/index";

// Every TxType value must be present — Record<TxType, ...> is exhaustive.
const TX_META: Record<TxType, { label: string; icon: string }> = {
  // ── Level 1/2 ──────────────────────────────────────────────────────────
  send_payment:      { label: "Send XLM",          icon: "💸" },
  create_campaign:   { label: "Create Campaign",   icon: "🚀" },
  contribute:        { label: "Contribution",       icon: "💰" },
  claim_funds:       { label: "Claim Funds",        icon: "🎉" },
  cancel_campaign:   { label: "Cancel Campaign",   icon: "❌" },
  // ── Level 3/4 ──────────────────────────────────────────────────────────
  add_milestone:     { label: "Add Milestone",     icon: "📋" },
  submit_milestone:  { label: "Submit Proof",       icon: "📄" },
  vote_milestone:    { label: "Vote on Milestone", icon: "🗳️" },
  release_milestone: { label: "Release Funds",     icon: "💸" },
  claim_refund:      { label: "Claim Refund",      icon: "↩️" },
  start_campaign:    { label: "Start Campaign",    icon: "⚡" },
};

function StatusBadge({ status }: { status: Transaction["status"] }) {
  if (status === "pending")
    return (
      <span className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Pending
      </span>
    );
  if (status === "success")
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Success
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Failed
    </span>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const meta = TX_META[tx.type];
  const explorerUrl =
    tx.id && tx.id.length > 10 ? explorerTxUrl(tx.id) : null;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <span className="text-xl mt-0.5 shrink-0">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-white/80 truncate">
            {meta.label}
          </span>
          <StatusBadge status={tx.status} />
        </div>

        {tx.amount !== undefined && (
          <p className="text-xs text-white/50 mb-0.5">
            Amount: {formatXLM(tx.amount)} XLM
          </p>
        )}
        {tx.to && (
          <p className="text-xs text-white/40 mb-0.5">
            To:{" "}
            <span className="font-mono">
              {tx.to.slice(0, 8)}...{tx.to.slice(-6)}
            </span>
          </p>
        )}
        {tx.campaignId !== undefined && (
          <p className="text-xs text-white/40">
            Campaign #{tx.campaignId.toString()}
            {tx.milestoneId !== undefined && ` · Milestone #${tx.milestoneId}`}
          </p>
        )}
        {tx.status === "failed" && tx.error && (
          <p className="text-xs text-red-400 mt-1">⚠ {tx.error}</p>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-white/30">
            {formatTimestamp(tx.timestamp)}
          </span>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-stellar-blue/70 hover:text-stellar-blue flex items-center gap-1 transition-colors"
            >
              {shortenAddress(tx.id, 4)}
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function TransactionHistory() {
  const { transactions, clearAll } = useTxStore();

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 className="font-semibold text-white text-sm">
          Transaction History
        </h3>
        {transactions.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="px-5 max-h-[400px] overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm text-white/30">No transactions yet</p>
            <p className="text-xs text-white/20 mt-1">
              Your transactions will appear here
            </p>
          </div>
        ) : (
          transactions.map((tx) => (
            <TxRow key={tx.id + tx.timestamp} tx={tx} />
          ))
        )}
      </div>
    </div>
  );
}