// ─── Network ─────────────────────────────────────────────────────────────────

export type Network = "testnet" | "mainnet";

// ─── Campaign Status ──────────────────────────────────────────────────────────
//
// Level 1/2 crowdfunding contract emits: Active | Successful | Failed | Cancelled
// Level 3/4 milestone contract emits:    Active | Funded | InProgress | Completed | Failed | Cancelled
//
// Both sets are included here so that:
//   - app/campaigns/[id]/page.tsx (Level 1/2) can compare === "Successful" without TS error
//   - app/milestones/page.tsx (Level 3/4) can compare === "InProgress" etc without TS error
//
export type CampaignStatus =
  | "Active"
  | "Successful"    // Level 1/2 crowdfunding contract
  | "Funded"        // Level 3/4 milestone contract
  | "InProgress"    // Level 3/4 milestone contract
  | "Completed"     // Level 3/4 milestone contract
  | "Failed"
  | "Cancelled";

export interface Campaign {
  id: bigint;
  creator: string;
  title: string;
  description: string;
  goal: bigint;
  raised: bigint;
  escrowed: bigint;
  released: bigint;
  deadline: bigint;
  status: CampaignStatus;
  backerCount: bigint;
  milestoneCount: number;
  createdAt: bigint;
}

export interface CampaignUI extends Campaign {
  goalXLM: number;
  raisedXLM: number;
  escrowedXLM: number;
  releasedXLM: number;
  progress: number;
  daysLeft: number;
  isExpired: boolean;
}

// ─── Milestone ────────────────────────────────────────────────────────────────

export type MilestoneStatus =
  | "Pending"
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
  // Level 1/2 contract events
  | "CAMP_NEW"
  | "CAMP_FUND"
  | "CAMP_CLAM"
  | "CAMP_CAN";

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