"use client";

import { useState } from "react";
import { useContribute } from "@/hooks/use-campaigns";
import { useWallet } from "@/hooks/use-wallet";
import { formatXLM } from "@/lib/stellar-utils";
import type { CampaignUI } from "@/types";

interface ContributeModalProps {
  campaign: CampaignUI;
  onClose: () => void;
}

const PRESET_AMOUNTS = [10, 50, 100, 500];

export function ContributeModal({ campaign, onClose }: ContributeModalProps) {
  const { isConnected, connect, balances } = useWallet();
  const { mutate: contribute, isPending } = useContribute();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const xlmBalance = parseFloat(balances.find((b) => b.asset === "XLM")?.balance || "0");
  const amountNum = parseFloat(amount);
  const isValid = !isNaN(amountNum) && amountNum >= 0.1;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValid) {
      setError("Minimum contribution is 0.1 XLM");
      return;
    }
    if (amountNum > xlmBalance) {
      setError("Insufficient XLM balance");
      return;
    }
    contribute(
      { campaignId: campaign.id, amountXLM: amountNum },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md bg-[#0d0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Back This Campaign</h2>
              <p className="text-sm text-white/50 mt-0.5 line-clamp-1">
                {campaign.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Campaign progress summary */}
        <div className="px-5 py-4 bg-white/[0.02] border-b border-white/5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/50">
              {formatXLM(campaign.raised)} XLM raised
            </span>
            <span className="text-white/50">
              Goal: {formatXLM(campaign.goal)} XLM
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-stellar-blue to-stellar-purple rounded-full"
              style={{ width: `${Math.min(100, campaign.progress)}%` }}
            />
          </div>
          <p className="text-xs text-white/40 mt-1.5">
            {campaign.progress}% funded · {campaign.daysLeft} days left
          </p>
        </div>

        {!isConnected ? (
          <div className="p-6 text-center">
            <p className="text-white/60 mb-4">Connect your wallet to contribute</p>
            <button
              onClick={connect}
              className="px-6 py-2.5 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white rounded-xl font-medium"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Balance display */}
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Your balance</span>
              <span className="text-white/70 font-medium">
                {xlmBalance.toFixed(4)} XLM
              </span>
            </div>

            {/* Preset amounts */}
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                    amount === String(preset)
                      ? "border-stellar-blue bg-stellar-blue/10 text-stellar-blue"
                      : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter amount"
                  min="0.1"
                  step="0.01"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/60 transition-colors text-sm pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40 font-medium">
                  XLM
                </span>
              </div>
              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>

            {/* Info */}
            {isValid && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                <p className="text-xs text-green-400">
                  You will contribute{" "}
                  <span className="font-semibold">{amountNum.toFixed(2)} XLM</span>{" "}
                  to this campaign
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !isValid}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Contribution ✨"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
