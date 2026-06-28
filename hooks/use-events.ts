"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchContractEvents } from "@/lib/soroban-client";
import { formatTimestamp, stroopsToXLM, shortenAddress } from "@/lib/stellar-utils";
import type { ActivityItem, ContractEvent, EventType } from "@/types";

const EVENT_LABELS: Record<EventType, { label: string; icon: string; color: string }> = {
  CAMP_NEW: { label: "Campaign Created", icon: "🚀", color: "text-blue-400" },
  CAMP_FUND: { label: "Campaign Funded", icon: "💰", color: "text-green-400" },
  CAMP_CLAM: { label: "Funds Claimed", icon: "🎉", color: "text-yellow-400" },
  CAMP_REF: { label: "Refund Issued", icon: "↩️", color: "text-orange-400" },
  CAMP_CAN: { label: "Campaign Cancelled", icon: "❌", color: "text-red-400" },
};

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
    amount: event.amount !== undefined ? stroopsToXLM(event.amount) : undefined,
    campaignId: event.campaignId,
    timestamp: event.timestamp,
    txHash: event.txHash,
    icon: meta.icon,
    color: meta.color,
  };
}

export function useContractEvents() {
  return useQuery({
    queryKey: ["contract-events"],
    queryFn: async () => {
      const events = await fetchContractEvents();
      return events
        .map(eventToActivity)
        .sort((a, b) => b.timestamp - a.timestamp);
    },
    refetchInterval: 15_000, // poll every 15s
    staleTime: 10_000,
  });
}
