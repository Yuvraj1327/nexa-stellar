import { CONTRACT_CONFIG } from "./contract-config";

// ─── XLM Conversions ─────────────────────────────────────────────────────────

export const STROOPS_PER_XLM = 10_000_000n;

export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}

export function stroopsToXLM(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}

export function formatXLM(stroops: bigint, decimals = 2): string {
  const xlm = stroopsToXLM(stroops);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(xlm);
}

export function formatXLMCompact(stroops: bigint): string {
  const xlm = stroopsToXLM(stroops);
  if (xlm >= 1_000_000) return `${(xlm / 1_000_000).toFixed(1)}M XLM`;
  if (xlm >= 1_000) return `${(xlm / 1_000).toFixed(1)}K XLM`;
  return `${xlm.toFixed(2)} XLM`;
}

// ─── Address Formatting ──────────────────────────────────────────────────────

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 1)}...${address.slice(-chars)}`;
}

export function explorerAddressUrl(address: string): string {
  return `${CONTRACT_CONFIG.explorerBase}/account/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${CONTRACT_CONFIG.explorerBase}/tx/${hash}`;
}

export function explorerContractUrl(contractId: string): string {
  return `${CONTRACT_CONFIG.explorerBase}/contract/${contractId}`;
}

// ─── Campaign Utilities ───────────────────────────────────────────────────────

export function calcProgress(raised: bigint, goal: bigint): number {
  if (goal === 0n) return 0;
  const pct = (Number(raised) / Number(goal)) * 100;
  return Math.min(100, Math.round(pct * 10) / 10);
}

export function calcDaysLeft(deadlineTimestamp: bigint): number {
  const now = Math.floor(Date.now() / 1000);
  const deadlineSec = Number(deadlineTimestamp);
  const diff = deadlineSec - now;
  return Math.max(0, Math.ceil(diff / 86400));
}

export function formatDeadline(deadlineTimestamp: bigint): string {
  const date = new Date(Number(deadlineTimestamp) * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const now = Date.now();
  const diff = now - ms;

  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function campaignStatusColor(status: string): string {
  switch (status) {
    case "Active":
      return "text-blue-400 bg-blue-400/10";
    case "Successful":
      return "text-green-400 bg-green-400/10";
    case "Failed":
      return "text-red-400 bg-red-400/10";
    case "Cancelled":
      return "text-gray-400 bg-gray-400/10";
    default:
      return "text-gray-400 bg-gray-400/10";
  }
}

// ─── Error Handling ───────────────────────────────────────────────────────────

export function parseStellarError(error: unknown): string {
  if (!error) return "Unknown error";
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("User declined")) return "Transaction rejected by wallet";
  if (msg.includes("insufficient balance") || msg.includes("op_underfunded"))
    return "Insufficient XLM balance";
  if (msg.includes("not found")) return "Wallet extension not found. Please install Freighter.";
  if (msg.includes("Campaign is not active")) return "This campaign is no longer accepting contributions";
  if (msg.includes("deadline has passed")) return "Campaign deadline has passed";
  if (msg.includes("Goal must be positive")) return "Campaign goal must be greater than 0";
  if (msg.includes("Only the creator")) return "Only the campaign creator can perform this action";
  if (msg.includes("HostError")) {
    const match = msg.match(/Error\(Contract, #(\d+)\)/);
    if (match) return `Contract error code: ${match[1]}`;
  }

  return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
