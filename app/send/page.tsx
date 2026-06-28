"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useSendPayment } from "@/hooks/use-send";
import { SendXLMModal } from "@/components/wallet/SendXLMModal";
import { TransactionHistory } from "@/components/shared/TransactionHistory";
import { explorerTxUrl, shortenAddress } from "@/lib/stellar-utils";
import Link from "next/link";

export default function SendPage() {
  const { isConnected, connect, address, balances } = useWallet();
  const [showModal, setShowModal] = useState(false);

  const xlmBalance = parseFloat(balances.find((b) => b.asset === "XLM")?.balance ?? "0");

  return (
    <>
      {showModal && <SendXLMModal onClose={() => setShowModal(false)} />}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Send XLM</h1>
          <p className="text-white/40 mt-1">
            Transfer XLM to any Stellar address on Testnet
          </p>
        </div>

        {!isConnected ? (
          /* Connect prompt */
          <div className="card p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-stellar-blue/10 border border-stellar-blue/20 flex items-center justify-center mx-auto mb-4 text-3xl">
              👛
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Wallet Required</h2>
            <p className="text-white/50 mb-6 text-sm">
              Connect your Stellar wallet to send XLM
            </p>
            <button
              onClick={connect}
              className="px-6 py-3 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-medium rounded-xl hover:shadow-lg hover:shadow-stellar-blue/20 transition-all"
            >
              Connect Wallet
            </button>
            <div className="mt-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl text-left">
              <p className="text-xs font-medium text-white/50 mb-2">Supported Wallets</p>
              <div className="flex flex-wrap gap-2">
                {["Freighter", "LOBSTR", "xBull", "Rabet", "Albedo"].map((w) => (
                  <span key={w} className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded-lg">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Wallet card */}
            <div className="card p-6 mb-6 bg-gradient-to-br from-stellar-blue/10 to-stellar-purple/5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">From</p>
                  <p className="font-mono text-sm text-white/80">{shortenAddress(address!, 8)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40 mb-1">Available</p>
                  <p className="text-2xl font-bold text-white">
                    {xlmBalance.toFixed(4)}
                    <span className="text-sm font-normal text-white/50 ml-1">XLM</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(true)}
                className="w-full py-3 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-stellar-blue/20 transition-all"
              >
                Send XLM →
              </button>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                {
                  icon: "⚡",
                  title: "3-5 Second Finality",
                  desc: "Stellar transactions settle in seconds, not minutes",
                },
                {
                  icon: "💸",
                  title: "Minimal Fees",
                  desc: "Base fee is 100 stroops (0.00001 XLM)",
                },
                {
                  icon: "🔒",
                  title: "Non-custodial",
                  desc: "You sign in your wallet — we never touch your keys",
                },
              ].map((item) => (
                <div key={item.title} className="card p-4">
                  <p className="text-xl mb-2">{item.icon}</p>
                  <p className="text-sm font-medium text-white mb-1">{item.title}</p>
                  <p className="text-xs text-white/40">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Friendbot helper */}
            <div className="card p-4 mb-6 border-yellow-500/20">
              <p className="text-sm font-medium text-yellow-400 mb-1">🤖 Need test XLM?</p>
              <p className="text-xs text-white/50 mb-3">
                On Testnet, you can get free XLM from Stellar Friendbot.
              </p>
              <a
                href={`https://friendbot.stellar.org?addr=${encodeURIComponent(address!)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-stellar-blue hover:underline"
              >
                Fund {shortenAddress(address!, 4)} with Friendbot ↗
              </a>
            </div>

            {/* Transaction history */}
            <TransactionHistory />
          </>
        )}

        {/* How it works */}
        <div className="mt-8">
          <h3 className="text-sm font-medium text-white/50 mb-4">How It Works</h3>
          <ol className="space-y-3">
            {[
              "Enter the recipient's Stellar address (starts with G)",
              "Enter the amount of XLM to send",
              "Approve the transaction in your wallet",
              "Stellar network confirms in 3-5 seconds",
              "View the transaction on Stellar Explorer",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-stellar-blue/10 border border-stellar-blue/20 text-stellar-blue text-xs flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-white/50">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
