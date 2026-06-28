"use client";

import Link from "next/link";
import type { CampaignUI } from "@/types";
import {
  formatXLM,
  formatDeadline,
  campaignStatusColor,
  shortenAddress,
} from "@/lib/stellar-utils";

interface CampaignCardProps {
  campaign: CampaignUI;
  showContribution?: bigint;
}

export function CampaignCard({ campaign, showContribution }: CampaignCardProps) {
  const progressBarColor =
    campaign.progress >= 100
      ? "bg-gradient-to-r from-green-500 to-emerald-400"
      : campaign.progress >= 50
      ? "bg-gradient-to-r from-stellar-blue to-stellar-purple"
      : "bg-gradient-to-r from-stellar-purple to-pink-500";

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <div className="group relative flex flex-col h-full bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer">
        {/* Gradient top bar */}
        <div
          className={`h-1 w-full ${progressBarColor} opacity-80`}
          style={{
            width: `${Math.max(2, campaign.progress)}%`,
            minWidth: "4px",
          }}
        />

        <div className="flex flex-col flex-1 p-5 gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${campaignStatusColor(campaign.status)}`}
                >
                  {campaign.status}
                </span>
                {campaign.daysLeft <= 2 && campaign.status === "Active" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-orange-400 bg-orange-400/10">
                    ⏰ Ending soon
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-white text-base leading-snug line-clamp-2 group-hover:text-stellar-blue transition-colors">
                {campaign.title}
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-white/50 line-clamp-2 flex-1">
            {campaign.description}
          </p>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-white/40">Progress</span>
              <span className="text-xs font-semibold text-white/70">
                {campaign.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${progressBarColor}`}
                style={{ width: `${Math.min(100, campaign.progress)}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div>
              <p className="text-xs text-white/40 mb-0.5">Raised</p>
              <p className="text-sm font-semibold text-white truncate">
                {formatXLM(campaign.raised)} XLM
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-0.5">Goal</p>
              <p className="text-sm font-semibold text-white truncate">
                {formatXLM(campaign.goal)} XLM
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-0.5">
                {campaign.isExpired ? "Ended" : "Days left"}
              </p>
              <p className="text-sm font-semibold text-white">
                {campaign.isExpired
                  ? formatDeadline(campaign.deadline)
                  : `${campaign.daysLeft}d`}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-xs text-white/30 font-mono">
              {shortenAddress(campaign.creator)}
            </span>
            <span className="text-xs text-white/30">
              {Number(campaign.backerCount)} backers
            </span>
          </div>

          {showContribution !== undefined && showContribution > 0n && (
            <div className="text-xs text-stellar-blue bg-stellar-blue/10 px-3 py-1.5 rounded-lg">
              ✓ You backed {formatXLM(showContribution)} XLM
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function CampaignCardSkeleton() {
  return (
    <div className="flex flex-col h-full bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden animate-pulse">
      <div className="h-1 w-1/3 bg-white/10" />
      <div className="flex flex-col flex-1 p-5 gap-4">
        <div>
          <div className="h-4 bg-white/10 rounded w-16 mb-2" />
          <div className="h-5 bg-white/10 rounded w-3/4 mb-1" />
          <div className="h-5 bg-white/10 rounded w-1/2" />
        </div>
        <div>
          <div className="h-3 bg-white/10 rounded w-full mb-1" />
          <div className="h-3 bg-white/10 rounded w-4/5" />
        </div>
        <div className="h-1.5 bg-white/10 rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="h-3 bg-white/10 rounded w-12 mb-1" />
              <div className="h-4 bg-white/10 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
