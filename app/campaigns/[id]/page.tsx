"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useCampaign,
  useMyContribution,
} from "@/hooks/use-campaigns";
import {
  useMilestones,
  useCancelCampaign,
} from "@/hooks/use-milestones";
import { ContributeModal } from "@/components/campaign/ContributeModal";
import { MilestonePanel, MilestoneSkeleton } from "@/components/milestone/MilestonePanel";
import { AddMilestoneModal } from "@/components/milestone/AddMilestoneModal";
import { useWallet } from "@/hooks/use-wallet";
import {
  formatXLM,
  formatDeadline,
  formatTimestamp,
  shortenAddress,
  explorerAddressUrl,
  campaignStatusColor,
  stroopsToXLM,
} from "@/lib/stellar-utils";
import Link from "next/link";

export default function CampaignDetailPage() {
  const params = useParams();
  const id = BigInt(String(params.id ?? "0"));

  const [showContribute, setShowContribute] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: campaign, isLoading, error } = useCampaign(id);
  const { data: myContribution } = useMyContribution(id);
  const { data: milestones, isLoading: milestonesLoading } = useMilestones(
    id,
    campaign?.milestoneCount ?? 0,
  );
  const { address } = useWallet();
  const { mutate: cancelCampaign, isPending: isCancelling } = useCancelCampaign();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-4 bg-white/10 rounded w-1/2 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 bg-white/5 rounded-2xl" />
            <div className="h-20 bg-white/5 rounded-2xl" />
          </div>
          <div className="h-64 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">🔍</p>
        <p className="text-white/60 font-medium mb-2">Campaign not found</p>
        <Link href="/campaigns" className="text-stellar-blue hover:underline text-sm">
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  const isCreator = !!address && address.toLowerCase() === campaign.creator.toLowerCase();
  const canContribute = campaign.status === "Active" && !campaign.isExpired;
  // Creator can cancel only if no funds have been raised yet
  const canCancel =
    isCreator &&
    (campaign.status === "Active" || campaign.status === "Funded") &&
    campaign.raised === 0n;
  const myContributionXLM = myContribution ? stroopsToXLM(myContribution) : 0;

  // Milestone actions
  const canAddMilestone =
    isCreator &&
    (campaign.status === "Active" ||
      campaign.status === "Funded" ||
      campaign.status === "InProgress");

  const escrowedXLM = Number(campaign.escrowed ?? 0n) / 10_000_000;
  const releasedXLM = Number(campaign.released ?? 0n) / 10_000_000;

  return (
    <>
      {showContribute && campaign && (
        <ContributeModal campaign={campaign} onClose={() => setShowContribute(false)} />
      )}
      {showAddMilestone && campaign && (
        <AddMilestoneModal
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          onClose={() => setShowAddMilestone(false)}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 mb-6 transition-colors"
        >
          ← All Campaigns
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main content ────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${campaignStatusColor(campaign.status)}`}
                >
                  {campaign.status}
                </span>
                <span className="text-xs text-white/30">
                  Campaign #{campaign.id.toString()}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">{campaign.title}</h1>
              <p className="text-white/60 leading-relaxed">{campaign.description}</p>
            </div>

            {/* Creator */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-white/50 mb-3">Creator</h3>
              <a
                href={explorerAddressUrl(campaign.creator)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stellar-blue to-stellar-purple flex items-center justify-center text-xs font-bold">
                  {campaign.creator.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-mono">
                    {shortenAddress(campaign.creator, 6)}
                    {isCreator && (
                      <span className="ml-2 text-xs text-stellar-blue">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-white/30">
                    Created {formatTimestamp(Number(campaign.createdAt) * 1000)}
                  </p>
                </div>
              </a>
            </div>

            {/* My Contribution */}
            {myContributionXLM > 0 && (
              <div className="card p-5 border-stellar-blue/20 bg-stellar-blue/5">
                <p className="text-sm text-stellar-blue font-medium">
                  ✓ You backed this campaign with{" "}
                  <span className="font-bold">{myContributionXLM.toFixed(2)} XLM</span>
                </p>
              </div>
            )}

            {/* Timeline */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-white/50 mb-3">Timeline</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/30 mb-1">Created</p>
                  <p className="text-sm text-white">{formatDeadline(campaign.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30 mb-1">Deadline</p>
                  <p className="text-sm text-white">
                    {formatDeadline(campaign.deadline)}
                    {!campaign.isExpired && campaign.daysLeft <= 7 && (
                      <span className="ml-2 text-xs text-orange-400">
                        {campaign.daysLeft}d left
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Milestones Section ─────────────────────────── */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    Milestones
                    {(campaign.milestoneCount ?? 0) > 0 && (
                      <span className="ml-2 text-xs text-white/30 font-normal">
                        {campaign.milestoneCount}
                      </span>
                    )}
                  </h3>
                  {(escrowedXLM > 0 || releasedXLM > 0) && (
                    <p className="text-xs text-white/40 mt-0.5">
                      🔒 {escrowedXLM.toFixed(2)} XLM in escrow
                      {releasedXLM > 0 && (
                        <span className="ml-2 text-purple-400">
                          · 💸 {releasedXLM.toFixed(2)} released
                        </span>
                      )}
                    </p>
                  )}
                </div>
                {canAddMilestone && (
                  <button
                    onClick={() => setShowAddMilestone(true)}
                    className="text-xs px-3 py-1.5 bg-stellar-blue/10 border border-stellar-blue/30 text-stellar-blue rounded-xl hover:bg-stellar-blue/20 transition-colors"
                  >
                    + Add Milestone
                  </button>
                )}
              </div>

              <div className="p-5 space-y-3">
                {milestonesLoading ? (
                  <>
                    <MilestoneSkeleton />
                    <MilestoneSkeleton />
                  </>
                ) : !milestones || milestones.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-3xl mb-2">🏁</p>
                    <p className="text-white/40 text-sm">No milestones yet</p>
                    {canAddMilestone && (
                      <button
                        onClick={() => setShowAddMilestone(true)}
                        className="mt-3 text-xs px-4 py-2 bg-stellar-blue/10 border border-stellar-blue/30 text-stellar-blue rounded-xl hover:bg-stellar-blue/20 transition-colors"
                      >
                        Add First Milestone 📋
                      </button>
                    )}
                    {!isCreator && (
                      <p className="text-white/20 text-xs mt-2">
                        The campaign creator will add milestones
                      </p>
                    )}
                  </div>
                ) : (
                  milestones.map((ms) => (
                    <MilestonePanel
                      key={ms.id}
                      milestone={ms}
                      campaign={campaign}
                      isCreator={isCreator}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar ─────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Progress card */}
            <div className="card p-5">
              <div className="mb-4">
                <p className="text-3xl font-bold text-white">
                  {formatXLM(campaign.raised)}{" "}
                  <span className="text-lg text-white/50 font-normal">XLM</span>
                </p>
                <p className="text-sm text-white/40 mt-0.5">
                  raised of {formatXLM(campaign.goal)} XLM goal
                </p>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-stellar-blue to-stellar-purple rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, campaign.progress)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5 text-center">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xl font-bold text-white">{campaign.progress}%</p>
                  <p className="text-xs text-white/40">funded</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xl font-bold text-white">
                    {Number(campaign.backerCount)}
                  </p>
                  <p className="text-xs text-white/40">backers</p>
                </div>
              </div>

              {/* Escrow display */}
              {escrowedXLM > 0 && (
                <div className="mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-yellow-400/70">🔒 In Escrow</span>
                    <span className="text-yellow-400 font-medium">
                      {escrowedXLM.toFixed(2)} XLM
                    </span>
                  </div>
                  {releasedXLM > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-purple-400/70">💸 Released</span>
                      <span className="text-purple-400 font-medium">
                        {releasedXLM.toFixed(2)} XLM
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Actions ─────────────────────────── */}
              {canContribute && (
                <button
                  onClick={() => setShowContribute(true)}
                  className="w-full py-3 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-stellar-blue/20 transition-all"
                >
                  Back This Campaign 💰
                </button>
              )}

              {campaign.status !== "Active" && campaign.status !== "Funded" && !canContribute && (
                <div
                  className={`w-full py-3 text-center rounded-xl text-sm font-medium ${campaignStatusColor(campaign.status)}`}
                >
                  Campaign {campaign.status}
                </div>
              )}

              {/* Cancel Campaign — with confirmation */}
              {canCancel && !confirmCancel && (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="w-full py-2 mt-3 border border-red-500/30 text-red-400/70 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/5 rounded-xl text-xs transition-colors"
                >
                  Cancel Campaign
                </button>
              )}

              {canCancel && confirmCancel && (
                <div className="mt-3 border border-red-500/30 bg-red-500/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-red-400">Cancel this campaign?</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        This action is permanent and recorded on-chain. The campaign will be
                        marked as Cancelled.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmCancel(false)}
                      className="flex-1 py-2 text-xs border border-white/10 text-white/50 hover:text-white rounded-xl transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        cancelCampaign(campaign.id, {
                          onSuccess: () => setConfirmCancel(false),
                          onError: () => setConfirmCancel(false),
                        });
                      }}
                      disabled={isCancelling}
                      className="flex-1 py-2 text-xs bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {isCancelling ? (
                        <>
                          <span className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        "Yes, Cancel"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Days left */}
            {campaign.status === "Active" && (
              <div className="card p-4 text-center">
                <p className="text-4xl font-bold text-white mb-1">{campaign.daysLeft}</p>
                <p className="text-sm text-white/40">
                  {campaign.daysLeft === 1 ? "day" : "days"} remaining
                </p>
                <p className="text-xs text-white/20 mt-1">
                  Ends {formatDeadline(campaign.deadline)}
                </p>
              </div>
            )}

            {/* Milestones quick-view in sidebar */}
            {(campaign.milestoneCount ?? 0) > 0 && (
              <div className="card p-4">
                <p className="text-xs font-medium text-white/50 mb-2">Milestone Progress</p>
                <div className="space-y-2">
                  {milestonesLoading
                    ? [0, 1].map((i) => (
                        <div key={i} className="h-7 bg-white/5 rounded-lg animate-pulse" />
                      ))
                    : milestones?.map((ms) => (
                        <div
                          key={ms.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-white/60 truncate flex-1">{ms.title}</span>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                              ms.status === "Released"
                                ? "text-purple-400 bg-purple-400/10"
                                : ms.status === "Approved"
                                ? "text-green-400 bg-green-400/10"
                                : ms.status === "Rejected"
                                ? "text-red-400 bg-red-400/10"
                                : ms.status === "Voting"
                                ? "text-yellow-400 bg-yellow-400/10"
                                : ms.status === "Submitted"
                                ? "text-cyan-400 bg-cyan-400/10"
                                : "text-gray-400 bg-gray-400/10"
                            }`}
                          >
                            {ms.status}
                          </span>
                        </div>
                      ))}
                </div>
                {canAddMilestone && (
                  <button
                    onClick={() => setShowAddMilestone(true)}
                    className="mt-3 w-full text-xs py-1.5 border border-white/10 text-white/40 hover:text-white/70 rounded-xl transition-colors"
                  >
                    + Add another milestone
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
