"use client";

import { useTxStore } from "@/lib/tx-store";
import {
  explorerTxUrl,
  formatTimestamp,
  formatXLM,
  shortenAddress,
} from "@/lib/stellar-utils";
import type { Transaction } from "@/types";
import Link from "next/link";

const TX_META: Record<
  Transaction["type"],
  { label: string; icon: string }
> = {
  send_payment: { label: "Send XLM", icon: "💸" },
  create_campaign: { label: "Create Campaign", icon: "🚀" },
  contribute: { label: "Contribution", icon: "💰" },
  claim_funds: { label: "Claim Funds", icon: "🎉" },
  cancel_campaign: { label: "Cancel Campaign", icon: "❌" },
};

function StatusIcon({ status }: { status: Transaction["status"] }) {
  if (status === "pending")
    return (
      <span className="w-5 h-5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin inline-block" />
    );
  if (status === "success")
    return <span className="text-green-400">✓</span>;
  return <span className="text-red-400">✗</span>;
}

export default function TxPage() {
  const { transactions, clearAll } = useTxStore();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Transaction History</h1>
          <p className="text-white/40 mt-1">
            Your on-chain interactions with Nexa
          </p>
        </div>
        {transactions.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-white/30 hover:text-white/60 border border-white/10 px-3 py-1.5 rounded-xl transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Total",
            value: transactions.length,
            color: "text-white",
          },
          {
            label: "Success",
            value: transactions.filter((t) => t.status === "success").length,
            color: "text-green-400",
          },
          {
            label: "Pending",
            value: transactions.filter((t) => t.status === "pending").length,
            color: "text-yellow-400",
          },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Transactions table */}
      <div className="card overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-white/50 font-medium">No transactions yet</p>
            <p className="text-white/30 text-sm mt-1 mb-4">
              Your transactions will appear here once you interact with the
              contract
            </p>
            <Link
              href="/campaigns"
              className="text-sm text-stellar-blue hover:underline"
            >
              Explore campaigns →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">
                    Campaign
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">
                    Time
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">
                    Tx Hash
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const meta = TX_META[tx.type];
                  return (
                    <tr
                      key={tx.id + tx.timestamp}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span>{meta.icon}</span>
                          <span className="text-sm text-white/70">
                            {meta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={tx.status} />
                          <span
                            className={`text-xs capitalize ${
                              tx.status === "success"
                                ? "text-green-400"
                                : tx.status === "pending"
                                ? "text-yellow-400"
                                : "text-red-400"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-white/50">
                        {tx.campaignId !== undefined
                          ? `#${tx.campaignId.toString()}`
                          : tx.to
                          ? `→ ${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-sm text-white/50">
                        {tx.amount !== undefined
                          ? `${formatXLM(tx.amount)} XLM`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/30">
                        {formatTimestamp(tx.timestamp)}
                      </td>
                      <td className="px-5 py-3">
                        {tx.id && tx.id.length > 10 ? (
                          <a
                            href={explorerTxUrl(tx.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-stellar-blue/70 hover:text-stellar-blue transition-colors flex items-center gap-1"
                          >
                            {shortenAddress(tx.id, 4)}
                            <span className="text-[10px]">↗</span>
                          </a>
                        ) : (
                          <span className="text-xs text-white/20">
                            {tx.id || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
