// ─── Milestone Types ──────────────────────────────────────────────────────────

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
  amount: bigint;           // stroops
  status: MilestoneStatus;
  proofUrl: string;
  voteYes: bigint;
  voteNo: bigint;
  voteDeadline: bigint;     // unix timestamp
  submittedAt: bigint;
}

export interface MilestoneUI extends Milestone {
  amountXLM: number;
  progress: number;         // vote progress %
  timeLeft: string;
  isVotingOpen: boolean;
  approvalPct: number;
}

export type CampaignStatus =
  | "Active"
  | "Funded"
  | "InProgress"
  | "Completed"
  | "Failed"
  | "Cancelled";

export interface CampaignV2 {
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

export interface CampaignV2UI extends CampaignV2 {
  goalXLM: number;
  raisedXLM: number;
  escrowedXLM: number;
  releasedXLM: number;
  progress: number;
  daysLeft: number;
  isExpired: boolean;
  milestones?: MilestoneUI[];
}

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface AnalyticsData {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalRaisedXLM: number;
  totalEscrowedXLM: number;
  totalReleasedXLM: number;
  totalBackers: number;
  totalMilestones: number;
  approvedMilestones: number;
  rejectedMilestones: number;
  successRate: number;        // %
  avgFundingXLM: number;
}

// ─── Feedback Types ───────────────────────────────────────────────────────────

export type FeedbackType = "bug" | "feature" | "general" | "milestone";
export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export interface FeedbackEntry {
  id: string;
  type: FeedbackType;
  rating: FeedbackRating;
  message: string;
  walletAddress?: string;
  timestamp: number;
  campaignId?: string;
}

// ─── Vote Types ───────────────────────────────────────────────────────────────

export interface VoteResult {
  yes: bigint;
  no: bigint;
  total: bigint;
  approvalPct: number;
  quorumMet: boolean;
  approved: boolean;
}
