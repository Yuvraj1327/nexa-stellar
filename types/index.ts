// ─── Network ─────────────────────────────────────────────────────────────────

export type Network = "testnet" | "mainnet";

// ─── Campaign Status ──────────────────────────────────────────────────────────
//
// Level 1/2 crowdfunding contract emits: Active | Successful | Failed | Cancelled
// Level 3/4 milestone contract emits:    Active | Funded | InProgress | Completed | Failed | Cancelled
//
// Both sets are included so all pages type-check correctly without casts.
//
export type CampaignStatus =
  | "Active"
  | "Successful"   // Level 1/2 crowdfunding contract
  | "Funded"       // Level 3/4 milestone contract
  | "InProgress"   // Level 3/4 milestone contract
  | "Completed"    // Level 3/4 milestone contract
  | "Failed"
  | "Cancelled";

// ─── Campaign ─────────────────────────────────────────────────────────────────
//
// Shared by both contracts.
//
// Level 1/2 crowdfunding contract does NOT have:
//   - escrowed       (no escrow mechanism)
//   - released       (no milestone releases)
//   - milestoneCount (no milestones)
//
// These fields are therefore optional so both contracts satisfy Campaign.
// When absent they default to 0/0n in parsers and UI transforms.
//
export interface Campaign {
  id: bigint;
  creator: string;
  title: string;
  description: string;
  goal: bigint;
  raised: bigint;
  escrowed?: bigint;        // L3/4 only — 0n when absent
  released?: bigint;        // L3/4 only — 0n when absent
  deadline: bigint;
  status: CampaignStatus;
  backerCount: bigint;
  milestoneCount?: number;  // L3/4 only — 0 when absent
  createdAt: bigint;
}

// CampaignUI adds computed display fields.
// All optional Campaign fields are resolved to concrete values here.
export interface CampaignUI extends Campaign {
  goalXLM: number;
  raisedXLM: number;
  escrowedXLM: number;    // 0 for L1/2 campaigns
  releasedXLM: number;    // 0 for L1/2 campaigns
  milestoneCount: number; // overrides optional — always 0 for L1/2 campaigns
  progress: number;
  daysLeft: number;
  isExpired: boolean;
}

// ─── Milestone ────────────────────────────────────────────────────────────────

export type MilestoneStatus =
  | "Pending"
  | "Submitted"
  | "Voting"
  | "Approved"
  | "Rejected"
  | "Released";

export interface Milestone {
  id: number;
  title: string;
  description: string;
  amount: bigint;
  status: MilestoneStatus;
  proofUrl: string;
  voteYes: bigint;
  voteNo: bigint;
  voteDeadline: bigint;
  submittedAt: bigint;
}

export interface MilestoneUI extends Milestone {
  amountXLM: number;
  approvalPct: number;
  timeLeft: string;
  isVotingOpen: boolean;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export type TxStatus = "pending" | "success" | "failed";

export type TxType =
  | "send_payment"
  | "create_campaign"
  | "contribute"
  | "claim_funds"
  | "cancel_campaign"
  | "add_milestone"
  | "submit_milestone"
  | "vote_milestone"
  | "release_milestone"
  | "claim_refund"
  | "start_campaign";

export interface Transaction {
  id: string;
  type: TxType;
  status: TxStatus;
  campaignId?: bigint;
  milestoneId?: number;
  amount?: bigint;
  from: string;
  to?: string;
  timestamp: number;
  ledger?: number;
  error?: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventType =
  | "CAMPCRTD"
  | "CONTRIB"
  | "MSSUB"
  | "VOTECAST"
  | "MSAPRVD"
  | "MSRJCTD"
  | "FUNDSREL"
  | "REFUND"
  | "CAMPDONE"
  | "CANCELD"
  // Level 1/2 crowdfunding contract events
  | "CAMP_NEW"    // campaign created
  | "CAMP_FUND"   // contribution received
  | "CAMP_CLAM"   // creator claimed funds
  | "CAMP_REF"    // refund issued  ← used in use-events.ts metadata
  | "CAMP_CAN";   // campaign cancelled

export interface ContractEvent {
  id: string;
  type: EventType;
  campaignId: bigint;
  actor: string;
  amount?: bigint;
  timestamp: number;
  txHash: string;
  ledger: number;
}

export interface ActivityItem {
  id: string;
  label: string;
  description: string;
  actor: string;
  amount?: number;
  campaignId: bigint;
  timestamp: number;
  txHash: string;
  icon: string;
  color: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  totalCampaigns: number;
  activeCampaigns: number;
  fundedCampaigns: number;
  completedCampaigns: number;
  failedCampaigns: number;
  totalRaisedXLM: number;
  totalEscrowedXLM: number;
  totalReleasedXLM: number;
  totalBackers: number;
  totalMilestones: number;
  approvedMilestones: number;
  rejectedMilestones: number;
  pendingMilestones: number;
  successRate: number;
  avgFundingXLM: number;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface WalletBalance {
  asset: string;
  balance: string;
  decimals: number;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  network: Network;
  balances: WalletBalance[];
  kit: unknown | null;
}

// ─── Campaign Input ───────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  title: string;
  description: string;
  goalXLM: number;
  durationDays: number;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export type FeedbackType = "bug" | "feature" | "general" | "ux";
export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export interface FeedbackEntry {
  id: string;
  type: FeedbackType;
  rating: FeedbackRating;
  message: string;
  walletAddress?: string;
  timestamp: number;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: "default" | "destructive" | "success";
  txHash?: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}