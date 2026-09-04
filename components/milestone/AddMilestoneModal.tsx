"use client";

import { useState } from "react";
import { useAddMilestone } from "@/hooks/use-milestones";
import { useWallet } from "@/hooks/use-wallet";
import { formatXLM } from "@/lib/stellar-utils";

interface AddMilestoneModalProps {
  campaignId: bigint;
  campaignTitle: string;
  onClose: () => void;
}

export function AddMilestoneModal({ campaignId, campaignTitle, onClose }: AddMilestoneModalProps) {
  const { isConnected } = useWallet();
  const { mutate: addMilestone, isPending } = useAddMilestone();

  const [form, setForm] = useState({ title: "", description: "", amountXLM: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 3)
      errs.title = "Title must be at least 3 characters";
    if (!form.description.trim() || form.description.trim().length < 10)
      errs.description = "Description must be at least 10 characters";
    const amt = parseFloat(form.amountXLM);
    if (isNaN(amt) || amt < 0.1) errs.amountXLM = "Amount must be at least 0.1 XLM";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    addMilestone(
      {
        campaignId,
        title: form.title.trim(),
        description: form.description.trim(),
        amountXLM: parseFloat(form.amountXLM),
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-[#0d0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold text-white">Add Milestone</h2>
            <p className="text-sm text-white/50 mt-0.5 truncate max-w-xs">{campaignTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {!isConnected ? (
          <div className="p-6 text-center">
            <p className="text-white/60 mb-2">Connect your wallet to add milestones</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* How it works info box */}
            <div className="bg-stellar-blue/5 border border-stellar-blue/20 rounded-xl p-3">
              <p className="text-xs text-stellar-blue/80 leading-relaxed">
                📋 Milestones define deliverables for your campaign. Backers vote to approve or reject each milestone before funds are released from escrow.
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Milestone Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. MVP Launch, Smart Contract Audit"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/60 transition-colors text-sm"
                maxLength={80}
              />
              {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe what will be delivered and how backers can verify completion..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/60 transition-colors text-sm resize-none"
                maxLength={300}
              />
              <div className="flex justify-between mt-1">
                {errors.description ? (
                  <p className="text-red-400 text-xs">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-white/30">{form.description.length}/300</span>
              </div>
            </div>

            {/* Release Amount */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Release Amount (XLM)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.amountXLM}
                  onChange={(e) => setForm((f) => ({ ...f, amountXLM: e.target.value }))}
                  placeholder="100"
                  min="0.1"
                  step="0.01"
                  className="w-full px-4 py-2.5 pr-16 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/60 transition-colors text-sm"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40 font-medium">
                  XLM
                </span>
              </div>
              {errors.amountXLM && (
                <p className="text-red-400 text-xs mt-1">{errors.amountXLM}</p>
              )}
              <p className="text-xs text-white/30 mt-1">
                This amount will be released from escrow when the milestone is approved by backers.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-medium text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-stellar-blue/20 transition-all"
              >
                {isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Milestone 📋"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
