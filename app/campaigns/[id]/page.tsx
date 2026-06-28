"use client";

import { useState } from "react";
import { useParams, notFound } from "next/navigation";
import {
  useCampaign,
  useMyContribution,
  useClaimFunds,
  useCancelCampaign,
} from "@/hooks/use-campaigns";
import { ContributeModal } from "@/components/campaign/ContributeModal";
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

  const { data: campaign, isLoading, error } = useCampaign(id);
  const { data: myContribution } = useMyContribution(id);
  const { address } = useWallet();
  const { mutate: claimFunds, isPending: isClaiming } = useClaimFunds();
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

  const isCreator = address?.toLowerCase() === campaign.creator.toLowerCase();
  const canContribute = campaign.status === "Active" && !campaign.isExpired;
  const canClaim = isCreator && campaign.status === "Successful";
  const canCancel = isCreator && campaign.status === "Active" && campaign.raised === 0n;
  const myContributionXLM = myContribution ? stroopsToXLM(myContribution) : 0;

  return (
    <>
      {showContribute && campaign && (
        <ContributeModal
          campaign={campaign}
          onClose={() => setShowContribute(false)}
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
          {/* Main content */}
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
              <h1 className="text-2xl font-bold text-white mb-3">
                {campaign.title}
              </h1>
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
                  <span className="font-bold">
                    {myContributionXLM.toFixed(2)} XLM
                  </span>
                </p>
              </div>
            )}

            {/* Timeline */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-white/50 mb-3">Timeline</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/30 mb-1">Created</p>
                  <p className="text-sm text-white">
                    {formatDeadline(campaign.createdAt)}
                  </p>
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
          </div>

          {/* Sidebar */}
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
                  <p className="text-xl font-bold text-white">
                    {campaign.progress}%
                  </p>
                  <p className="text-xs text-white/40">funded</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xl font-bold text-white">
                    {Number(campaign.backerCount)}
                  </p>
                  <p className="text-xs text-white/40">backers</p>
                </div>
              </div>

              {/* Actions */}
              {canContribute && (
                <button
                  onClick={() => setShowContribute(true)}
                  className="w-full py-3 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-stellar-blue/20 transition-all"
                >
                  Back This Campaign 💰
                </button>
              )}

              {canClaim && (
                <button
                  onClick={() => claimFunds(campaign.id)}
                  disabled={isClaiming}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-400 text-white font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isClaiming ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    "Claim Funds 🎉"
                  )}
                </button>
              )}

              {canCancel && (
                <button
                  onClick={() => cancelCampaign(campaign.id)}
                  disabled={isCancelling}
                  className="w-full py-2 mt-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-sm transition-colors disabled:opacity-60"
                >
                  {isCancelling ? "Cancelling..." : "Cancel Campaign"}
                </button>
              )}

              {campaign.status !== "Active" && !canClaim && (
                <div
                  className={`w-full py-3 text-center rounded-xl text-sm font-medium ${campaignStatusColor(campaign.status)}`}
                >
                  Campaign {campaign.status}
                </div>
              )}
            </div>

            {/* Days left */}
            {campaign.status === "Active" && (
              <div className="card p-4 text-center">
                <p className="text-4xl font-bold text-white mb-1">
                  {campaign.daysLeft}
                </p>
                <p className="text-sm text-white/40">
                  {campaign.daysLeft === 1 ? "day" : "days"} remaining
                </p>
                <p className="text-xs text-white/20 mt-1">
                  Ends {formatDeadline(campaign.deadline)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
