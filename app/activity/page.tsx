"use client";

import { useContractEvents } from "@/hooks/use-events";
import { useCampaigns } from "@/hooks/use-campaigns";
import {
  explorerTxUrl,
  explorerAddressUrl,
  shortenAddress,
  formatTimestamp,
} from "@/lib/stellar-utils";
import type { ActivityItem } from "@/types";
import Link from "next/link";

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-white/5 last:border-0 group">
      <div
        className={`shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg`}
      >
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
          <span className="text-xs text-white/30">·</span>
          <span className="text-xs text-white/30">{formatTimestamp(item.timestamp)}</span>
        </div>
        <p className="text-sm text-white/50">{item.description}</p>
        <div className="flex items-center gap-3 mt-1.5">
          {item.actor && (
            <a
              href={explorerAddressUrl(item.actor)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors"
            >
              {shortenAddress(item.actor)}
            </a>
          )}
          <Link
            href={`/campaigns/${item.campaignId}`}
            className="text-xs text-white/30 hover:text-stellar-blue transition-colors"
          >
            Campaign #{item.campaignId.toString()}
          </Link>
        </div>
      </div>
      <a
        href={explorerTxUrl(item.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs text-white/20 hover:text-stellar-blue transition-colors opacity-0 group-hover:opacity-100"
      >
        ↗ tx
      </a>
    </div>
  );
}

function MockActivityRow({ index }: { index: number }) {
  const mocks = [
    {
      icon: "🚀",
      label: "Campaign Created",
      description: "Campaign #1 · Goal: 500 XLM",
      color: "text-blue-400",
      time: "2 hours ago",
    },
    {
      icon: "💰",
      label: "Campaign Funded",
      description: "Campaign #1 · 50 XLM contributed",
      color: "text-green-400",
      time: "1 hour ago",
    },
    {
      icon: "💰",
      label: "Campaign Funded",
      description: "Campaign #2 · 100 XLM contributed",
      color: "text-green-400",
      time: "30 minutes ago",
    },
  ];
  const m = mocks[index % mocks.length];
  return (
    <div className="flex items-start gap-4 py-4 border-b border-white/5 last:border-0 opacity-50">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg">
        {m.icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm font-medium ${m.color}`}>{m.label}</span>
          <span className="text-xs text-white/30">· {m.time}</span>
        </div>
        <p className="text-sm text-white/50">{m.description}</p>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { data: events, isLoading, refetch, dataUpdatedAt } = useContractEvents();
  const { data: campaigns } = useCampaigns();

  const totalEvents = events?.length ?? 0;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Activity Feed</h1>
          <p className="text-white/40 mt-1">
            Real-time events from the crowdfunding contract
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-white">{totalEvents}</p>
          <p className="text-xs text-white/40 mt-1">Total Events</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-white">
            {campaigns?.length ?? 0}
          </p>
          <p className="text-xs text-white/40 mt-1">Campaigns</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">Live</span>
          </div>
          <p className="text-xs text-white/40">
            Polling every 15s
          </p>
        </div>
      </div>

      {/* Last update */}
      {lastUpdate && (
        <p className="text-xs text-white/20 mb-4">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </p>
      )}

      {/* Feed */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white text-sm">Contract Events</h3>
          <p className="text-xs text-white/30 mt-0.5">
            Events emitted by the Soroban crowdfunding contract
          </p>
        </div>

        <div className="px-5 max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-stellar-blue/30 border-t-stellar-blue rounded-full animate-spin" />
              <p className="text-white/40 text-sm mt-3">Fetching events...</p>
            </div>
          ) : !events || events.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-3xl mb-3">📡</p>
              <p className="text-white/50 font-medium mb-1">No events yet</p>
              <p className="text-white/30 text-sm mb-4">
                Events will appear here once campaigns are created and funded
              </p>
              <p className="text-xs text-white/20 mb-3">Sample events (preview)</p>
              {[0, 1, 2].map((i) => (
                <MockActivityRow key={i} index={i} />
              ))}
            </div>
          ) : (
            events.map((item) => <ActivityRow key={item.id} item={item} />)
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 card p-4">
        <p className="text-xs font-medium text-white/50 mb-3">Event Types</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { icon: "🚀", label: "Campaign Created", color: "text-blue-400" },
            { icon: "💰", label: "Funded", color: "text-green-400" },
            { icon: "🎉", label: "Funds Claimed", color: "text-yellow-400" },
            { icon: "↩️", label: "Refund", color: "text-orange-400" },
            { icon: "❌", label: "Cancelled", color: "text-red-400" },
          ].map((e) => (
            <div key={e.label} className="flex items-center gap-2">
              <span>{e.icon}</span>
              <span className={`text-xs ${e.color}`}>{e.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
