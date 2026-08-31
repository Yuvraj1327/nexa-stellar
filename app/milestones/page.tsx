"use client";
import { useState } from "react";
import Link from "next/link";
import { useCampaigns, useMilestones } from "@/hooks/use-milestones";
import { MilestonePanel, MilestoneSkeleton } from "@/components/milestone/MilestonePanel";
import { useWallet } from "@/hooks/use-wallet";
import type { CampaignUI } from "@/types/index";

function CampaignSection({ campaign }: { campaign: CampaignUI }) {
  const { data: milestones, isLoading } = useMilestones(campaign.id, campaign.milestoneCount);
  const { address } = useWallet();
  const isCreator = address?.toLowerCase() === campaign.creator.toLowerCase();
  const [open, setOpen] = useState(false);

  const STATUS_COLOR: Record<string, string> = {
    Active: "text-blue-400", Funded: "text-cyan-400", InProgress: "text-yellow-400",
    Completed: "text-green-400", Failed: "text-red-400", Cancelled: "text-gray-400",
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stellar-blue/20 to-stellar-purple/20 flex items-center justify-center text-base shrink-0">
            {campaign.status === "Completed" ? "🎉" : campaign.status === "InProgress" ? "⚡" : campaign.status === "Funded" ? "💰" : "📋"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm truncate">{campaign.title}</span>
              <span className={`text-xs font-medium shrink-0 ${STATUS_COLOR[campaign.status]}`}>{campaign.status}</span>
            </div>
            <p className="text-xs text-white/40">{campaign.milestoneCount} milestones · {campaign.raisedXLM.toFixed(0)}/{campaign.goalXLM.toFixed(0)} XLM</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <Link href={`/campaigns/${campaign.id}`} onClick={e => e.stopPropagation()} className="text-xs text-stellar-blue hover:underline">View</Link>
          <span className="text-white/20">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      <div className="px-5 pb-2">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-stellar-blue to-stellar-purple rounded-full" style={{ width: `${campaign.progress}%` }} />
        </div>
      </div>
      {open && (
        <div className="px-5 pb-5 pt-3 border-t border-white/5 space-y-3">
          {isLoading ? <MilestoneSkeleton /> :
            !milestones || milestones.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-white/30 text-sm">No milestones yet</p>
                {isCreator && <Link href={`/campaigns/${campaign.id}`} className="text-xs text-stellar-blue hover:underline mt-1 inline-block">Add milestones →</Link>}
              </div>
            ) : milestones.map(ms => <MilestonePanel key={ms.id} milestone={ms} campaign={campaign} isCreator={isCreator} />)
          }
        </div>
      )}
    </div>
  );
}

export default function MilestonesPage() {
  const { data: campaigns, isLoading, refetch } = useCampaigns();
  const [filter, setFilter] = useState("All");
  const FILTERS = ["All", "InProgress", "Funded", "Active", "Completed"];
  const filtered = (campaigns ?? []).filter(c => filter === "All" || c.status === filter);
  const inProgress = (campaigns ?? []).filter(c => c.status === "InProgress");
  const withMs = (campaigns ?? []).filter(c => c.milestoneCount > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Milestones</h1>
          <p className="text-white/40 mt-1">Track deliverables and vote on milestone approvals</p>
        </div>
        <button onClick={() => refetch()} className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/40 hover:text-white transition-colors">↻</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{inProgress.length}</p>
          <p className="text-xs text-white/40 mt-1">Active Projects</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{withMs.length}</p>
          <p className="text-xs text-white/40 mt-1">With Milestones</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-center">
          <span className="flex items-center justify-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">Live</span>
          </span>
          <p className="text-xs text-white/30">Polls 10s</p>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mb-6">
        <p className="text-xs font-medium text-white/40 mb-2">How voting works</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {["📄 Creator submits proof", "🗳️ Backers vote 7 days", "✅ 60% Yes = Approved", "💸 Funds released from escrow"].map(s => (
            <span key={s} className="text-xs text-white/40">{s}</span>
          ))}
        </div>
      </div>

      <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-6 w-fit">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${filter === f ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
          <p className="text-4xl mb-3">🏁</p>
          <p className="text-white/50 font-medium">No campaigns found</p>
          <Link href="/campaigns" className="text-stellar-blue text-sm hover:underline mt-2 inline-block">Browse campaigns →</Link>
        </div>
      ) : (
        <div className="space-y-4">{filtered.map(c => <CampaignSection key={c.id.toString()} campaign={c} />)}</div>
      )}
    </div>
  );
}
