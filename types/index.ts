// ─── Stellar / Soroban Types ────────────────────────────────────────────────

export type Network = "testnet" | "mainnet";

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  explorerBase: string;
  horizonUrl: string;
}

// ─── Campaign Types ──────────────────────────────────────────────────────────

export type CampaignStatus = "Active" | "Successful" | "Failed" | "Cancelled";

export interface Campaign {
  id: bigint;
  creator: string;
  title: string;
  description: string;
  goal: bigint;           // in stroops
  raised: bigint;         // in stroops
  deadline: bigint;       // ledger timestamp (unix seconds)
  status: CampaignStatus;
  backerCount: bigint;
  createdAt: bigint;
}

export interface CampaignUI extends Campaign {
  goalXLM: number;
  raisedXLM: number;
  progress: number;       // 0-100
  daysLeft: number;
  isExpired: boolean;
}

export interface CreateCampaignInput {
  title: string;
  description: string;
  goalXLM: number;
  durationDays: number;
}

// ─── Transaction Types ───────────────────────────────────────────────────────

export type TxStatus = "pending" | "success" | "failed";

export interface Transaction {
  id: string;             // tx hash
  type: TxType;
  status: TxStatus;
  campaignId?: bigint;
  amount?: bigint;        // stroops
  from: string;
  to?: string;            // recipient (for send_payment)
  timestamp: number;      // unix ms
  ledger?: number;
  error?: string;
}

export type TxType =
  | "send_payment"
  | "create_campaign"
  | "contribute"
  | "claim_funds"
  | "cancel_campaign";

// ─── Event Types ────────────────────────────────────────────────────────────

export type EventType =
  | "CAMP_NEW"
  | "CAMP_FUND"
  | "CAMP_CLAM"
  | "CAMP_REF"
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
  amount?: number;       // XLM
  campaignId: bigint;
  timestamp: number;
  txHash: string;
  icon: string;
  color: string;
}

// ─── Wallet Types ────────────────────────────────────────────────────────────

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

// ─── UI Types ────────────────────────────────────────────────────────────────

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: "default" | "destructive" | "success";
  txHash?: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}
