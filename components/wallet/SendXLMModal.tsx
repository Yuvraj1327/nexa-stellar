"use client";

import { useState } from "react";
import { useSendPayment } from "@/hooks/use-send";
import { useWallet } from "@/hooks/use-wallet";
import { isValidStellarAddress } from "@/lib/payment-client";
import { explorerTxUrl } from "@/lib/stellar-utils";

interface SendXLMModalProps {
  onClose: () => void;
}

export function SendXLMModal({ onClose }: SendXLMModalProps) {
  const { isConnected, connect, balances } = useWallet();
  const { state, send, reset } = useSendPayment();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ to?: string; amount?: string }>({});

  const xlmBalance = parseFloat(balances.find((b) => b.asset === "XLM")?.balance ?? "0");
  const amountNum = parseFloat(amount);

  function validate(): boolean {
    const errs: { to?: string; amount?: string } = {};
    if (!to.trim()) {
      errs.to = "Recipient address is required";
    } else if (!isValidStellarAddress(to.trim())) {
      errs.to = "Invalid Stellar address (must start with G...)";
    }
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      errs.amount = "Enter a valid amount";
    } else if (amountNum < 0.0000001) {
      errs.amount = "Minimum amount is 0.0000001 XLM";
    } else if (amountNum + 1 > xlmBalance) {
      errs.amount = `Insufficient balance. Max sendable: ${Math.max(0, xlmBalance - 1).toFixed(4)} XLM`;
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await send({ to: to.trim(), amountXLM: amountNum, memo: memo.trim() || undefined });
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ─── Success State ────────────────────────────────────────────────────────
  if (state.status === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative z-10 w-full max-w-md bg-[#0d0f16] border border-green-500/30 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Payment Sent!</h2>
          <p className="text-white/60 text-sm mb-1">
            <span className="font-semibold text-white">{amountNum} XLM</span> sent successfully
          </p>
          <p className="text-white/40 text-xs mb-6">to {to.slice(0, 8)}...{to.slice(-8)}</p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-white/40 mb-1">Transaction Hash</p>
            <p className="text-xs font-mono text-white/80 break-all">{state.hash}</p>
          </div>

          <div className="flex gap-3">
            <a
              href={explorerTxUrl(state.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 text-sm text-center text-stellar-blue border border-stellar-blue/30 rounded-xl hover:bg-stellar-blue/10 transition-colors"
            >
              View on Explorer ↗
            </a>
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 text-sm bg-gradient-to-r from-stellar-blue to-stellar-purple text-white rounded-xl font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Failed State ─────────────────────────────────────────────────────────
  if (state.status === "failed") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative z-10 w-full max-w-md bg-[#0d0f16] border border-red-500/30 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Payment Failed</h2>
          <p className="text-red-400 text-sm mb-6 leading-relaxed">{state.error}</p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 text-sm border border-white/10 text-white/60 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={reset}
              className="flex-1 py-2.5 text-sm bg-gradient-to-r from-stellar-blue to-stellar-purple text-white rounded-xl font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isBusy =
    state.status === "building" ||
    state.status === "awaiting_signature" ||
    state.status === "submitting";

  const statusLabel = {
    idle: null,
    building: "Building transaction...",
    awaiting_signature: "Waiting for wallet signature...",
    submitting: "Submitting to Stellar...",
    success: null,
    failed: null,
  }[state.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={isBusy ? undefined : handleClose} />
      <div className="relative z-10 w-full max-w-md bg-[#0d0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white">Send XLM</h2>
            <p className="text-xs text-white/40 mt-0.5">Transfer on Stellar Testnet</p>
          </div>
          {!isBusy && (
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5">
              ✕
            </button>
          )}
        </div>

        {!isConnected ? (
          <div className="p-6 text-center">
            <p className="text-white/60 mb-4">Connect your wallet to send XLM</p>
            <button onClick={connect} className="px-6 py-2.5 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white rounded-xl font-medium">
              Connect Wallet
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Balance display */}
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Available balance</span>
              <span className="text-white/80 font-medium">{xlmBalance.toFixed(4)} XLM</span>
            </div>

            {/* Recipient */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Recipient Address
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => { setTo(e.target.value); setFieldErrors((f) => ({ ...f, to: undefined })); }}
                placeholder="G... (Stellar public key)"
                disabled={isBusy}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-stellar-blue/50 disabled:opacity-50 font-mono"
              />
              {fieldErrors.to && <p className="text-red-400 text-xs mt-1">{fieldErrors.to}</p>}
            </div>

            {/* Amount */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-medium text-white/60">Amount (XLM)</label>
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.max(0, xlmBalance - 1).toFixed(4)))}
                  className="text-xs text-stellar-blue hover:underline disabled:opacity-50"
                  disabled={isBusy}
                >
                  Max
                </button>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setFieldErrors((f) => ({ ...f, amount: undefined })); }}
                placeholder="0.00"
                min="0.0000001"
                step="0.0000001"
                disabled={isBusy}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-stellar-blue/50 disabled:opacity-50"
              />
              {fieldErrors.amount && <p className="text-red-400 text-xs mt-1">{fieldErrors.amount}</p>}
            </div>

            {/* Memo (optional) */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Memo <span className="text-white/30">(optional, max 28 chars)</span>
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value.slice(0, 28))}
                placeholder="e.g. Payment for services"
                disabled={isBusy}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-stellar-blue/50 disabled:opacity-50"
              />
            </div>

            {/* Loading status */}
            {isBusy && (
              <div className="flex items-center gap-3 bg-stellar-blue/5 border border-stellar-blue/20 rounded-xl p-3">
                <span className="w-4 h-4 border-2 border-stellar-blue/30 border-t-stellar-blue rounded-full animate-spin shrink-0" />
                <span className="text-xs text-stellar-blue">{statusLabel}</span>
              </div>
            )}

            {/* Network notice */}
            {!isBusy && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
                <p className="text-xs text-yellow-400/80">
                  ⚠️ This sends real XLM on <strong>Stellar Testnet</strong>. Get free test XLM from{" "}
                  <a
                    href="https://laboratory.stellar.org/#account-creator?network=test"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Friendbot
                  </a>
                  .
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={isBusy}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBusy ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Send XLM →"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
