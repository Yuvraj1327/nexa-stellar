"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchContractEvents } from "@/lib/soroban-client";
import {
  formatTimestamp,
  stroopsToXLM,
  shortenAddress,
} from "@/lib/stellar-utils";
import type { ActivityItem, ContractEvent, EventType } from "@/types/index";

// ─── Event Metadata ───────────────────────────────────────────────────────────
//
// Every key MUST be a member of EventType.
// If you add a new event to EventType, add its metadata here too.
//
const EVENT_LABELS: Record<
  EventType,
  { label: string; icon: string; color: string }
> = {
  // ── Level 3/4 Milestone Contract ───────────────────────────────────────────
  CAMPCRTD: { label: "Campaign Created",   icon: "🚀", color: "text-blue-400"   },
  CONTRIB:  { label: "Campaign Funded",    icon: "💰", color: "text-green-400"  },
  MSSUB:    { label: "Milestone Submitted",icon: "📄", color: "text-cyan-400"   },
  VOTECAST: { label: "Vote Cast",          icon: "🗳️", color: "text-yellow-400" },
  MSAPRVD:  { label: "Milestone Approved", icon: "✅", color: "text-green-400"  },
  MSRJCTD:  { label: "Milestone Rejected", icon: "❌", color: "text-red-400"    },
  FUNDSREL: { label: "Funds Released",     icon: "💸", color: "text-purple-400" },
  REFUND:   { label: "Refund Issued",      icon: "↩️", color: "text-orange-400" },
  CAMPDONE: { label: "Campaign Completed", icon: "🎉", color: "text-green-400"  },
  CANCELD:  { label: "Campaign Cancelled", icon: "🚫", color: "text-gray-400"   },
  // ── Level 1/2 Crowdfunding Contract ───────────────────────────────────────
  CAMP_NEW:  { label: "Campaign Created",  icon: "🚀", color: "text-blue-400"   },
  CAMP_FUND: { label: "Campaign Funded",   icon: "💰", color: "text-green-400"  },
  CAMP_CLAM: { label: "Funds Claimed",     icon: "🎉", color: "text-yellow-400" },
  CAMP_REF:  { label: "Refund Issued",     icon: "↩️", color: "text-orange-400" },
  CAMP_CAN:  { label: "Campaign Cancelled",icon: "❌", color: "text-red-400"    },
};

// ─── Transform ────────────────────────────────────────────────────────────────

function eventToActivity(event: ContractEvent): ActivityItem {
  const meta = EVENT_LABELS[event.type] ?? {
    label: "Unknown Event",
    icon: "❓",
    color: "text-gray-400",
  };

  let description = `Campaign #${event.campaignId}`;
  if (event.amount !== undefined) {
    description += ` · ${stroopsToXLM(event.amount).toFixed(2)} XLM`;
  }

  return {
    id: event.id,
    label: meta.label,
    description,
    actor: event.actor,
    amount:
      event.amount !== undefined ? stroopsToXLM(event.amount) : undefined,
    campaignId: event.campaignId,
    timestamp: event.timestamp,
    txHash: event.txHash,
    icon: meta.icon,
    color: meta.color,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContractEvents() {
  return useQuery({
    queryKey: ["contract-events"],
    queryFn: async () => {
      const events = await fetchContractEvents();
      return events
        .map(eventToActivity)
        .sort((a, b) => b.timestamp - a.timestamp);
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}