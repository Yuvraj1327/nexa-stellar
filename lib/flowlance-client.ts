/**
 * flowlance-client.ts
 *
 * Legacy client — superseded by milestone-client.ts.
 * Kept to avoid TypeScript "unused file" issues.
 * All new code should use milestone-client.ts instead.
 */

import {
  Contract,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import type {
  Campaign,
  CampaignStatus,
  Milestone,
  MilestoneStatus,
  AnalyticsData,
} from "@/types/index";

// Re-export aliases for any code that may reference CampaignV2
export type { Campaign as CampaignV2 };

// ─── Config ──────────────────────────────────────────────────────────────────

const FLOWLANCE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_FLOWLANCE_CONTRACT_ID ||
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  "";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

const DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// ─── RPC ─────────────────────────────────────────────────────────────────────

let _server: rpc.Server | null = null;
export function getServer(): rpc.Server {
  if (!_server) _server = new rpc.Server(RPC_URL, { allowHttp: true });
  return _server;
}

export function getFlowLanceContract(): Contract {
  return new Contract(FLOWLANCE_CONTRACT_ID);
}

// ─── ScVal Helpers ────────────────────────────────────────────────────────────

const a = (addr: string) => new Address(addr).toScVal();
const u64 = (n: bigint) => nativeToScVal(n, { type: "u64" });
const u32 = (n: number) => nativeToScVal(n, { type: "u32" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const b = (v: boolean) => nativeToScVal(v, { type: "bool" });

// ─── Simulation ───────────────────────────────────────────────────────────────

async function simulate(method: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const server = getServer();
  const contract = getFlowLanceContract();
  const account = await server.getAccount(DUMMY);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) throw new Error("Simulation failed");
  return sim.result.retval;
}

async function buildTx(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const server = getServer();
  const contract = getFlowLanceContract();
  const account = await server.getAccount(sourceAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error("Simulation failed");
  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function submitAndPoll(
  signedXdr: string,
  onStatus?: (status: string) => void,
): Promise<{ hash: string; ledger?: number }> {
  const server = getServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  onStatus?.("submitting");
  const send = await server.sendTransaction(tx);
  if (send.status === "ERROR") throw new Error("Submission failed");
  const hash = send.hash;
  onStatus?.("pending");
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await server.getTransaction(hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      onStatus?.("success");
      return { hash, ledger: res.ledger };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      onStatus?.("failed");
      throw new Error("Transaction failed on-chain");
    }
  }
  throw new Error("Transaction timeout");
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseStatus(raw: unknown): CampaignStatus {
  if (typeof raw === "object" && raw !== null)
    return Object.keys(raw as object)[0] as CampaignStatus;
  return raw as CampaignStatus;
}

function parseMilestoneStatus(raw: unknown): MilestoneStatus {
  if (typeof raw === "object" && raw !== null)
    return Object.keys(raw as object)[0] as MilestoneStatus;
  return raw as MilestoneStatus;
}

export function parseCampaign(val: xdr.ScVal): Campaign {
  const r = scValToNative(val) as Record<string, unknown>;
  return {
    id: BigInt(String(r.id ?? 0)),
    creator: String(r.creator ?? ""),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    goal: BigInt(String(r.goal ?? 0)),
    raised: BigInt(String(r.raised ?? 0)),
    escrowed: BigInt(String(r.escrowed ?? 0)),
    released: BigInt(String(r.released ?? 0)),
    deadline: BigInt(String(r.deadline ?? 0)),
    status: parseStatus(r.status),
    backerCount: BigInt(String(r.backer_count ?? 0)),
    milestoneCount: Number(r.milestone_count ?? 0),
    createdAt: BigInt(String(r.created_at ?? 0)),
  };
}

export function parseMilestone(val: xdr.ScVal): Milestone {
  const r = scValToNative(val) as Record<string, unknown>;
  return {
    id: Number(r.id ?? 0),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    amount: BigInt(String(r.amount ?? 0)),
    status: parseMilestoneStatus(r.status),
    proofUrl: String(r.proof_url ?? ""),
    voteYes: BigInt(String(r.vote_yes ?? 0)),
    voteNo: BigInt(String(r.vote_no ?? 0)),
    voteDeadline: BigInt(String(r.vote_deadline ?? 0)),
    submittedAt: BigInt(String(r.submitted_at ?? 0)),
  };
}

// ─── Read-Only ────────────────────────────────────────────────────────────────

export async function fetchCampaignV2(id: bigint): Promise<Campaign> {
  return parseCampaign(await simulate("get_campaign", [u64(id)]));
}

export async function fetchCampaignCount(): Promise<bigint> {
  return scValToNative(await simulate("get_campaign_count", [])) as bigint;
}

export async function fetchAllCampaignsV2(): Promise<Campaign[]> {
  const count = await fetchCampaignCount();
  if (count === 0n) return [];
  const results = await Promise.all(
    Array.from({ length: Number(count) }, (_, i) =>
      fetchCampaignV2(BigInt(i + 1)).catch(() => null),
    ),
  );
  return results.filter(Boolean) as Campaign[];
}

export async function fetchAllMilestones(
  campaignId: bigint,
  count: number,
): Promise<Milestone[]> {
  if (count === 0) return [];
  const results = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      simulate("get_milestone", [u64(campaignId), u32(i + 1)])
        .then((v) => parseMilestone(v))
        .catch(() => null),
    ),
  );
  return results.filter(Boolean) as Milestone[];
}

export async function fetchXLMBalance(address: string): Promise<string> {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
    if (!res.ok) return "0";
    const data = await res.json();
    const xlm = data.balances?.find(
      (b: { asset_type: string }) => b.asset_type === "native",
    );
    return xlm?.balance || "0";
  } catch {
    return "0";
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const campaigns = await fetchAllCampaignsV2();
  let totalRaised = 0n, totalEscrowed = 0n, totalReleased = 0n, totalBackers = 0n;
  let totalMilestones = 0, approvedMilestones = 0, rejectedMilestones = 0;
  let pendingMilestones = 0, completed = 0, failed = 0, active = 0, funded = 0;

  for (const c of campaigns) {
    totalRaised += c.raised;
    totalEscrowed += c.escrowed;
    totalReleased += c.released;
    totalBackers += c.backerCount;
    totalMilestones += c.milestoneCount;
    if (c.status === "Completed" || c.status === "Successful") completed++;
    else if (c.status === "Failed") failed++;
    else if (c.status === "Active") active++;
    else if (c.status === "Funded") funded++;

    try {
      const mss = await fetchAllMilestones(c.id, c.milestoneCount);
      for (const ms of mss) {
        if (ms.status === "Approved" || ms.status === "Released") approvedMilestones++;
        else if (ms.status === "Rejected") rejectedMilestones++;
        else if (ms.status === "Pending" || ms.status === "Voting") pendingMilestones++;
      }
    } catch {}
  }

  const n = campaigns.length;
  return {
    totalCampaigns: n,
    activeCampaigns: active,
    fundedCampaigns: funded,
    completedCampaigns: completed,
    failedCampaigns: failed,
    totalRaisedXLM: Number(totalRaised) / 10_000_000,
    totalEscrowedXLM: Number(totalEscrowed) / 10_000_000,
    totalReleasedXLM: Number(totalReleased) / 10_000_000,
    totalBackers: Number(totalBackers),
    totalMilestones,
    approvedMilestones,
    rejectedMilestones,
    pendingMilestones,
    successRate: n > 0 ? Math.round((completed / n) * 100) : 0,
    avgFundingXLM: n > 0 ? Math.round(Number(totalRaised) / 10_000_000 / n) : 0,
  };
}

// ─── Transaction Builders ─────────────────────────────────────────────────────

export const buildCreateCampaignTx = (
  from: string, title: string, description: string,
  goalStroops: bigint, durationSec: bigint,
) => buildTx(from, "create_campaign", [
  a(from),
  nativeToScVal(title, { type: "string" }),
  nativeToScVal(description, { type: "string" }),
  i128(goalStroops),
  u64(durationSec),
]);

export const buildContributeTx = (from: string, campaignId: bigint, amt: bigint) =>
  buildTx(from, "contribute", [u64(campaignId), a(from), i128(amt)]);

export const buildVoteTx = (from: string, cid: bigint, mid: number, approve: boolean) =>
  buildTx(from, "vote_milestone", [u64(cid), u32(mid), a(from), b(approve)]);

export const buildClaimRefundTx = (from: string, campaignId: bigint) =>
  buildTx(from, "claim_refund", [u64(campaignId), a(from)]);