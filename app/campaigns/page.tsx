"use client";

import { useState } from "react";
import { useCampaigns } from "@/hooks/use-campaigns";
import { CampaignCard, CampaignCardSkeleton } from "@/components/campaign/CampaignCard";
import { CreateCampaignModal } from "@/components/campaign/CreateCampaignModal";
import type { CampaignStatus } from "@/types";

const STATUS_FILTERS: { label: string; value: CampaignStatus | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Active", value: "Active" },
  { label: "Successful", value: "Successful" },
  { label: "Failed", value: "Failed" },
  { label: "Cancelled", value: "Cancelled" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Most Funded", value: "raised" },
  { label: "Ending Soon", value: "deadline" },
  { label: "Most Backers", value: "backers" },
];

export default function CampaignsPage() {
  const { data: campaigns, isLoading, refetch } = useCampaigns();
  const [filter, setFilter] = useState<CampaignStatus | "All">("All");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = (campaigns ?? [])
    .filter((c) => {
      if (filter !== "All" && c.status !== filter) return false;
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "raised") return Number(b.raised - a.raised);
      if (sort === "deadline") return Number(a.deadline - b.deadline);
      if (sort === "backers") return Number(b.backerCount - a.backerCount);
      return Number(b.createdAt - a.createdAt);
    });

  return (
    <>
      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">All Campaigns</h1>
            <p className="text-white/40 mt-1">
              {campaigns?.length ?? 0} total campaigns on Stellar
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 px-4 py-2 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white text-sm font-medium rounded-xl hover:shadow-lg hover:shadow-stellar-blue/20 transition-all"
          >
            + New Campaign
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-stellar-blue/40 transition-colors"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Status filter */}
          <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  filter === f.value
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 focus:outline-none focus:border-stellar-blue/40 transition-colors"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => refetch()}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 card">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-white/60 font-medium">No campaigns found</p>
            <p className="text-white/30 text-sm mt-1">
              {search ? "Try a different search term" : "Be the first to create one"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <CampaignCard key={c.id.toString()} campaign={c} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
