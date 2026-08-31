/**
 * types/milestone.ts
 *
 * Re-exports from types/index.ts for backwards compatibility.
 * All canonical type definitions live in types/index.ts.
 *
 * CampaignV2 is aliased to Campaign (same shape, new contract adds escrowed/released/milestoneCount).
 * CampaignV2UI is aliased to CampaignUI.
 */

export type {
  CampaignStatus,
  Campaign,
  CampaignUI,
  MilestoneStatus,
  Milestone,
  MilestoneUI,
  AnalyticsData,
  FeedbackType,
  FeedbackRating,
  FeedbackEntry,
  ContractEvent,
  EventType,
  ActivityItem,
  TxType,
  TxStatus,
  Transaction,
  ToastMessage,
  WalletBalance,
  Network,
  CreateCampaignInput,
  PaginationState,
} from "./index";

// Aliases so flowlance-client.ts compiles without changes
import type { Campaign, CampaignUI } from "./index";
export type CampaignV2    = Campaign;
export type CampaignV2UI  = CampaignUI;