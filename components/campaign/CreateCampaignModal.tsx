"use client";

import { useState } from "react";
import { useCreateCampaign } from "@/hooks/use-campaigns";
import { useWallet } from "@/hooks/use-wallet";

interface CreateCampaignModalProps {
  onClose: () => void;
}

export function CreateCampaignModal({ onClose }: CreateCampaignModalProps) {
  const { isConnected, connect } = useWallet();
  const { mutate: createCampaign, isPending } = useCreateCampaign();

  const [form, setForm] = useState({
    title: "",
    description: "",
    goalXLM: "",
    durationDays: "30",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.title.trim() || form.title.length < 5)
      errs.title = "Title must be at least 5 characters";
    if (!form.description.trim() || form.description.length < 20)
      errs.description = "Description must be at least 20 characters";
    const goal = parseFloat(form.goalXLM);
    if (isNaN(goal) || goal < 1) errs.goalXLM = "Goal must be at least 1 XLM";
    const days = parseInt(form.durationDays);
    if (isNaN(days) || days < 1 || days > 365)
      errs.durationDays = "Duration must be between 1 and 365 days";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    createCampaign(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        goalXLM: parseFloat(form.goalXLM),
        durationDays: parseInt(form.durationDays),
      },
      {
        onSuccess: () => onClose(),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-[#0d0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold text-white">Create Campaign</h2>
            <p className="text-sm text-white/50 mt-0.5">
              Launch your project on Stellar
            </p>
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
            <p className="text-white/60 mb-4">
              Connect your wallet to create a campaign
            </p>
            <button
              onClick={connect}
              className="px-6 py-2.5 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white rounded-xl font-medium"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Campaign Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Build a Community Garden"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/60 transition-colors text-sm"
                maxLength={100}
              />
              {errors.title && (
                <p className="text-red-400 text-xs mt-1">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Describe your project and what you'll build with the funds..."
                rows={4}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/60 transition-colors text-sm resize-none"
                maxLength={500}
              />
              <div className="flex justify-between mt-1">
                {errors.description ? (
                  <p className="text-red-400 text-xs">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-white/30">
                  {form.description.length}/500
                </span>
              </div>
            </div>

            {/* Goal + Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Funding Goal (XLM)
                </label>
                <input
                  type="number"
                  value={form.goalXLM}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, goalXLM: e.target.value }))
                  }
                  placeholder="1000"
                  min="1"
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/60 transition-colors text-sm"
                />
                {errors.goalXLM && (
                  <p className="text-red-400 text-xs mt-1">{errors.goalXLM}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Duration (days)
                </label>
                <input
                  type="number"
                  value={form.durationDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationDays: e.target.value }))
                  }
                  placeholder="30"
                  min="1"
                  max="365"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/60 transition-colors text-sm"
                />
                {errors.durationDays && (
                  <p className="text-red-400 text-xs mt-1">{errors.durationDays}</p>
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="bg-stellar-blue/5 border border-stellar-blue/20 rounded-xl p-3">
              <p className="text-xs text-stellar-blue/80">
                ⚡ Campaign will be deployed to Stellar {" "}
                <span className="font-semibold">Testnet</span>. A small XLM fee
                is required to cover network transaction costs.
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
                    Deploying...
                  </>
                ) : (
                  "Launch Campaign 🚀"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
