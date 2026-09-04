"use client";

import { useState } from "react";
import type { MilestoneUI, CampaignUI } from "@/types/index";
import {
  useVoteMilestone,
  useSubmitMilestone,
  useFinalizeMilestone,
  useReleaseMilestone,
  useHasVoted,
} from "@/hooks/use-milestones";
import { useWallet } from "@/hooks/use-wallet";
import { explorerTxUrl } from "@/lib/stellar-utils";

const STATUS_STYLES: Record<string, string> = {
  Pending:   "text-gray-400 bg-gray-400/10 border-gray-400/20",
  Submitted: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  Voting:    "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Approved:  "text-green-400 bg-green-400/10 border-green-400/20",
  Rejected:  "text-red-400 bg-red-400/10 border-red-400/20",
  Released:  "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const STATUS_ICON: Record<string, string> = {
  Pending: "⏳", Submitted: "📄", Voting: "🗳️", Approved: "✅", Rejected: "❌", Released: "💸",
};

interface Props {
  milestone: MilestoneUI;
  campaign: CampaignUI;
  isCreator: boolean;
}

export function MilestonePanel({ milestone, campaign, isCreator }: Props) {
  const { isConnected } = useWallet();
  const [proofUrl, setProofUrl] = useState("");
  const [showProofForm, setShowProofForm] = useState(false);

  const { mutate: vote, isPending: isVoting } = useVoteMilestone();
  const { mutate: submit, isPending: isSubmitting } = useSubmitMilestone();
  const { mutate: finalize, isPending: isFinalizing } = useFinalizeMilestone();
  const { mutate: release, isPending: isReleasing } = useReleaseMilestone();
  const { data: hasVoted } = useHasVoted(campaign.id, milestone.id);

  // Creator can submit proof when milestone is Pending and campaign is active (Active, Funded, or InProgress)
  const campaignAllowsSubmit = ["Active", "Funded", "InProgress"].includes(campaign.status);
  const canSubmit = isCreator && milestone.status === "Pending" && campaignAllowsSubmit;
  const canVote = isConnected && milestone.isVotingOpen && !hasVoted && !isCreator;
  const canFinalize = milestone.status === "Voting" && !milestone.isVotingOpen;
  const canRelease = isCreator && milestone.status === "Approved";

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white/30 text-xs font-mono shrink-0">#{milestone.id}</span>
          <h4 className="font-medium text-white text-sm truncate">{milestone.title}</h4>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLES[milestone.status]}`}>
          {STATUS_ICON[milestone.status]} {milestone.status}
        </span>
      </div>

      {milestone.description && (
        <p className="text-xs text-white/50 leading-relaxed">{milestone.description}</p>
      )}

      {/* Amount */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/40 text-xs">Release amount</span>
        <span className="font-semibold text-white">{milestone.amountXLM.toFixed(2)} XLM</span>
      </div>

      {/* Proof link */}
      {milestone.proofUrl && (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
          <p className="text-xs text-white/30 mb-1">Proof</p>
          <a href={milestone.proofUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-stellar-blue hover:underline break-all">
            {milestone.proofUrl}
          </a>
        </div>
      )}

      {/* Vote results */}
      {["Submitted", "Voting", "Approved", "Rejected", "Released"].includes(milestone.status) && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/40">
            <span>✅ Yes: {milestone.voteYes.toString()}</span>
            <span>❌ No: {milestone.voteNo.toString()}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
              style={{ width: `${milestone.approvalPct}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-green-400">{milestone.approvalPct}% approval</span>
            {milestone.isVotingOpen && <span className="text-yellow-400">{milestone.timeLeft}</span>}
          </div>
        </div>
      )}

      {/* Already voted */}
      {hasVoted && (
        <div className="text-xs text-stellar-blue bg-stellar-blue/10 px-3 py-1.5 rounded-lg">
          ✓ You voted on this milestone
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {canSubmit && !showProofForm && (
          <button onClick={() => setShowProofForm(true)}
            className="px-3 py-1.5 text-xs bg-stellar-blue/10 border border-stellar-blue/30 text-stellar-blue rounded-xl hover:bg-stellar-blue/20 transition-colors">
            Submit Proof 📄
          </button>
        )}

        {canVote && (
          <>
            <button onClick={() => vote({ campaignId: campaign.id, milestoneId: milestone.id, approve: true })}
              disabled={isVoting}
              className="flex-1 py-1.5 text-xs bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl hover:bg-green-500/20 disabled:opacity-50 transition-colors">
              {isVoting ? "..." : "✅ Vote Yes"}
            </button>
            <button onClick={() => vote({ campaignId: campaign.id, milestoneId: milestone.id, approve: false })}
              disabled={isVoting}
              className="flex-1 py-1.5 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 disabled:opacity-50 transition-colors">
              {isVoting ? "..." : "❌ Vote No"}
            </button>
          </>
        )}

        {canFinalize && (
          <button onClick={() => finalize({ campaignId: campaign.id, milestoneId: milestone.id })}
            disabled={isFinalizing}
            className="px-3 py-1.5 text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl hover:bg-yellow-500/20 disabled:opacity-50 transition-colors">
            {isFinalizing ? "Finalizing..." : "Finalize Vote 🏁"}
          </button>
        )}

        {canRelease && (
          <button onClick={() => release({ campaignId: campaign.id, milestoneId: milestone.id })}
            disabled={isReleasing}
            className="w-full py-2 text-xs bg-gradient-to-r from-stellar-blue to-stellar-purple text-white rounded-xl font-medium disabled:opacity-50">
            {isReleasing ? "Releasing..." : `Release ${milestone.amountXLM.toFixed(2)} XLM 💸`}
          </button>
        )}
      </div>

      {/* Proof form */}
      {showProofForm && (
        <div className="border border-white/10 rounded-xl p-3 space-y-2 bg-white/[0.02]">
          <p className="text-xs font-medium text-white">Submit Proof URL</p>
          <input type="url" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)}
            placeholder="https://github.com/... or IPFS link"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-stellar-blue/50" />
          <div className="flex gap-2">
            <button onClick={() => setShowProofForm(false)}
              className="flex-1 py-1.5 text-xs border border-white/10 text-white/50 rounded-xl hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={() => { if (!proofUrl.trim()) return; submit({ campaignId: campaign.id, milestoneId: milestone.id, proofUrl: proofUrl.trim() }); setShowProofForm(false); }}
              disabled={isSubmitting || !proofUrl.trim()}
              className="flex-1 py-1.5 text-xs bg-stellar-blue text-white rounded-xl disabled:opacity-50">
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MilestoneSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 bg-white/10 rounded w-1/3" />
        <div className="h-5 bg-white/10 rounded w-16" />
      </div>
      <div className="h-3 bg-white/10 rounded w-full" />
      <div className="h-1.5 bg-white/10 rounded-full" />
    </div>
  );
}
