/**
 * Milestone Contract Client
 *
 * Single client for ALL contract operations — reads AND writes.
 * Contract: NEXT_PUBLIC_MILESTONE_CONTRACT_ID
 *
 * This is the only file that touches the Soroban contract.
 * soroban-client.ts and flowlance-client.ts both re-export from here.
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
import { CONTRACT_CONFIG } from "@/lib/contract-config";
import type {
  Campaign,
  CampaignStatus,
  ContractEvent,
  EventType,
} from "@/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type MilestoneStatus =
  | "Pending"
  | "Submitted"
  | "Voting"
  | "Approved"
  | "Rejected"
  | "Released";

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

// ─── RPC & Contract Singletons ────────────────────────────────────────────────

let _server: rpc.Server | null = null;
export function getServer(): rpc.Server {
  if (!_server)
    _server = new rpc.Server(CONTRACT_CONFIG.rpcUrl, { allowHttp: true });
  return _server;
}

export function getMilestoneContract(): Contract {
  if (!CONTRACT_CONFIG.milestoneContractId)
    throw new Error("NEXT_PUBLIC_MILESTONE_CONTRACT_ID is not set");
  return new Contract(CONTRACT_CONFIG.milestoneContractId);
}

/** Fetch the native XLM balance for an address via Horizon. */
export async function fetchXLMBalance(address: string): Promise<string> {
  const res = await fetch(`${CONTRACT_CONFIG.horizonUrl}/accounts/${address}`);
  if (!res.ok) return "0";
  const data = await res.json() as { balances?: { asset_type: string; balance: string }[] };
  const xlm = data.balances?.find((b) => b.asset_type === "native");
  return xlm?.balance ?? "0";
}

// ─── ScVal Helpers ────────────────────────────────────────────────────────────

const a = (addr: string) => new Address(addr).toScVal();
const u64 = (n: bigint) => nativeToScVal(n, { type: "u64" });
const u32 = (n: number) => nativeToScVal(n, { type: "u32" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const s = (v: string) => nativeToScVal(v, { type: "string" });
const b = (v: boolean) => nativeToScVal(v, { type: "bool" });

// ─── Read-only Simulation ─────────────────────────────────────────────────────

// Use the deployer address (known-funded testnet account) for read simulations.
// The deployer address is always valid and funded on testnet.
const SIM_SOURCE = "GDMXTCW3JSACHI6UGDVOGN3KOR6VHWTYNFVCOO5ZOE2KCGLOKF2YFUKE";

async function simulate(
  method: string,
  args: xdr.ScVal[],
): Promise<xdr.ScVal> {
  const server = getServer();
  const contract = getMilestoneContract();

  let account;
  try {
    account = await server.getAccount(SIM_SOURCE);
  } catch {
    // Fallback: try any funded account we know about
    throw new Error(
      `Cannot fetch account for simulation. RPC may be unreachable.`,
    );
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONTRACT_CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  let sim;
  try {
    sim = await server.simulateTransaction(tx);
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err ?? "");
    if (msg.includes("Bad union switch") || msg.includes("union switch")) {
      throw new Error(
        "Contract simulation failed — XDR decode error. " +
          "Ensure @stellar/stellar-sdk 14.x is installed and .next cache is cleared.",
      );
    }
    throw err;
  }

  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result)
    throw new Error("Simulation failed");

  return sim.result.retval;
}

// ─── Write Transaction Builder ────────────────────────────────────────────────

async function buildTx(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const server = getServer();
  const contract = getMilestoneContract();
  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONTRACT_CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  let sim;
  try {
    sim = await server.simulateTransaction(tx);
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err ?? "");
    if (msg.includes("Bad union switch") || msg.includes("union switch")) {
      throw new Error(
        "Contract simulation failed — XDR decode error. " +
          "Ensure @stellar/stellar-sdk 14.x is installed and .next cache is cleared.",
      );
    }
    throw err;
  }

  if (rpc.Api.isSimulationError(sim)) {
    const errMsg = sim.error || "Contract error";
    if (errMsg.includes("Unauthorized"))
      throw new Error("You are not authorized for this action");
    if (errMsg.includes("already voted"))
      throw new Error("You have already voted on this milestone");
    if (errMsg.includes("Only backers"))
      throw new Error("Only campaign backers can vote");
    if (errMsg.includes("not accepting funds"))
      throw new Error("Campaign is not currently accepting contributions");
    if (errMsg.includes("Minimum goal"))
      throw new Error("Minimum campaign goal is 1 XLM");
    if (errMsg.includes("Minimum duration"))
      throw new Error("Minimum campaign duration is 1 hour");
    if (errMsg.includes("Goal must be at least"))
      throw new Error("Minimum campaign goal is 1 XLM");
    if (errMsg.includes("Duration must be at least"))
      throw new Error("Minimum campaign duration is 1 hour");
    throw new Error(errMsg);
  }

  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error("Simulation failed");
  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

// ─── Submit + Poll ────────────────────────────────────────────────────────────

export async function submitAndPoll(
  signedXdr: string,
  onStatus?: (s: string) => void,
): Promise<{ hash: string; ledger?: number }> {
  const server = getServer();
  const tx = TransactionBuilder.fromXDR(
    signedXdr,
    CONTRACT_CONFIG.networkPassphrase,
  );
  onStatus?.("submitting");
  const send = await server.sendTransaction(tx);
  if (send.status === "ERROR") {
    const errDetail =
      (send as unknown as { errorResult?: { result?: () => { switch?: () => { name: string } } } })
        ?.errorResult?.result?.()?.switch?.()?.name ?? "unknown";
    throw new Error(`Transaction submission failed: ${errDetail}`);
  }
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
  throw new Error("Transaction timeout — check the explorer for status");
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

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

export function parseCampaignV2(val: xdr.ScVal): CampaignV2 {
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

// Convert CampaignV2 → Campaign (UI type used by hooks/use-campaigns.ts)
export function campaignV2ToUI(c: CampaignV2): Campaign {
  const STROOPS = 10_000_000;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isExpired = c.deadline > 0n && now > c.deadline;

  let status = c.status as string;
  // Map on-chain status to UI CampaignStatus
  if (status === "Funded") status = "Active"; // treat funded as still "active" for UI
  if (status === "InProgress") status = "Active";
  if (status === "Completed") status = "Successful";
  if (isExpired && status === "Active" && c.raised < c.goal)
    status = "Failed";

  return {
    id: String(c.id),
    creator: c.creator,
    title: c.title,
    description: c.description,
    goalXLM: Number(c.goal) / STROOPS,
    raisedXLM: Number(c.raised) / STROOPS,
    deadline: new Date(Number(c.deadline) * 1000).toISOString(),
    backerCount: Number(c.backerCount),
    status: status as CampaignStatus,
    escrowed: c.escrowed,
    released: c.released,
    milestoneCount: c.milestoneCount,
    // Legacy fields (soroban-client compat)
    goal: c.goal,
    raised: c.raised,
    campaignId: c.id,
  } as unknown as Campaign;
}

// ─── Read-Only Calls ──────────────────────────────────────────────────────────

/** Fetch a single campaign by ID from the milestone contract. */
export async function fetchCampaignById(id: bigint): Promise<CampaignV2> {
  return parseCampaignV2(await simulate("get_campaign", [u64(id)]));
}

/** Fetch total campaign count from the milestone contract. */
export async function fetchCampaignCount(): Promise<bigint> {
  return scValToNative(await simulate("get_campaign_count", [])) as bigint;
}

/** Fetch all campaigns from the milestone contract. */
export async function fetchAllCampaigns(): Promise<CampaignV2[]> {
  const count = await fetchCampaignCount();
  if (count === 0n) return [];
  const results = await Promise.allSettled(
    Array.from({ length: Number(count) }, (_, i) =>
      fetchCampaignById(BigInt(i + 1)),
    ),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<CampaignV2> => r.status === "fulfilled")
    .map((r) => r.value);
}

/** Fetch a milestone from the milestone contract. */
export async function fetchMilestone(
  campaignId: bigint,
  milestoneId: number,
): Promise<Milestone> {
  return parseMilestone(
    await simulate("get_milestone", [u64(campaignId), u32(milestoneId)]),
  );
}

/** Fetch all milestones for a campaign. */
export async function fetchAllMilestones(
  campaignId: bigint,
  count: number,
): Promise<Milestone[]> {
  if (count === 0) return [];
  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) =>
      fetchMilestone(campaignId, i + 1),
    ),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<Milestone> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function fetchContribution(
  campaignId: bigint,
  backer: string,
): Promise<bigint> {
  return scValToNative(
    await simulate("get_contribution", [u64(campaignId), a(backer)]),
  ) as bigint;
}

export async function fetchHasVoted(
  campaignId: bigint,
  milestoneId: number,
  voter: string,
): Promise<boolean> {
  return scValToNative(
    await simulate("has_voted", [u64(campaignId), u32(milestoneId), a(voter)]),
  ) as boolean;
}

export async function fetchIsRefundClaimed(
  campaignId: bigint,
  backer: string,
): Promise<boolean> {
  return scValToNative(
    await simulate("is_refund_claimed", [u64(campaignId), a(backer)]),
  ) as boolean;
}

export async function fetchBackerCampaigns(
  backer: string,
): Promise<bigint[]> {
  return (scValToNative(
    await simulate("get_backer_campaigns", [a(backer)]),
  ) as bigint[]) || [];
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const campaigns = await fetchAllCampaigns();
  let totalRaised = 0n,
    totalEscrowed = 0n,
    totalReleased = 0n,
    totalBackers = 0n,
    totalMilestones = 0,
    approvedMilestones = 0,
    rejectedMilestones = 0,
    pendingMilestones = 0,
    completed = 0;

  for (const c of campaigns) {
    totalRaised += c.raised;
    totalEscrowed += c.escrowed;
    totalReleased += c.released;
    totalBackers += c.backerCount;
    totalMilestones += c.milestoneCount;
    if (c.status === "Completed") completed++;
    try {
      const mss = await fetchAllMilestones(c.id, c.milestoneCount);
      for (const ms of mss) {
        if (ms.status === "Approved" || ms.status === "Released")
          approvedMilestones++;
        else if (ms.status === "Rejected") rejectedMilestones++;
        else if (ms.status === "Pending" || ms.status === "Submitted" || ms.status === "Voting")
          pendingMilestones++;
      }
    } catch {}
  }

  const n = campaigns.length;
  const active = campaigns.filter(
    (c) => c.status === "Active" || c.status === "Funded" || c.status === "InProgress",
  );
  return {
    totalCampaigns: n,
    activeCampaigns: active.length,
    fundedCampaigns: campaigns.filter((c) => c.status === "Funded").length,
    completedCampaigns: completed,
    failedCampaigns: campaigns.filter((c) => c.status === "Failed").length,
    totalRaisedXLM: Number(totalRaised) / 10_000_000,
    totalEscrowedXLM: Number(totalEscrowed) / 10_000_000,
    totalReleasedXLM: Number(totalReleased) / 10_000_000,
    totalBackers: Number(totalBackers),
    totalMilestones,
    approvedMilestones,
    rejectedMilestones,
    pendingMilestones,
    successRate: n > 0 ? Math.round((completed / n) * 100) : 0,
    avgFundingXLM:
      n > 0 ? Math.round(Number(totalRaised) / 10_000_000 / n) : 0,
  };
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function fetchContractEvents(
  cursor?: string,
): Promise<ContractEvent[]> {
  const server = getServer();
  try {
    const res = await server.getEvents({
      startLedger: cursor ? undefined : 1,
      filters: [
        {
          type: "contract",
          contractIds: [CONTRACT_CONFIG.milestoneContractId],
        },
      ],
      limit: 50,
    });
    return (res.events || []).map((e) => {
      const topics = e.topic.map((t) =>
        scValToNative(t),
      ) as string[];
      const values = e.value ? [scValToNative(e.value)] : [];
      const type = (topics[0] as EventType) || "UNKNOWN";
      return {
        id: e.txHash + "-" + e.ledger,
        type,
        campaignId: 0n,
        actor: "",
        timestamp: 0,
        txHash: e.txHash,
        ledger: e.ledger,
        topics,
        values,
      } as unknown as ContractEvent;
    });
  } catch {
    return [];
  }
}

// ─── Transaction Builders (Write) ─────────────────────────────────────────────

export const buildCreateCampaignTx = (
  from: string,
  title: string,
  description: string,
  goalStroops: bigint,
  durationSec: bigint,
) =>
  buildTx(from, "create_campaign", [
    a(from),
    s(title),
    s(description),
    i128(goalStroops),
    u64(durationSec),
  ]);

export const buildAddMilestoneTx = (
  from: string,
  campaignId: bigint,
  title: string,
  description: string,
  amountStroops: bigint,
) =>
  buildTx(from, "add_milestone", [
    u64(campaignId),
    a(from),
    s(title),
    s(description),
    i128(amountStroops),
  ]);

export const buildContributeTx = (
  from: string,
  campaignId: bigint,
  amountStroops: bigint,
) =>
  buildTx(from, "contribute", [u64(campaignId), a(from), i128(amountStroops)]);

export const buildStartCampaignTx = (from: string, campaignId: bigint) =>
  buildTx(from, "start_campaign", [u64(campaignId), a(from)]);

export const buildSubmitMilestoneTx = (
  from: string,
  campaignId: bigint,
  milestoneId: number,
  proofUrl: string,
) =>
  buildTx(from, "submit_milestone", [
    u64(campaignId),
    u32(milestoneId),
    a(from),
    s(proofUrl),
  ]);

export const buildVoteMilestoneTx = (
  from: string,
  campaignId: bigint,
  milestoneId: number,
  approve: boolean,
) =>
  buildTx(from, "vote_milestone", [
    u64(campaignId),
    u32(milestoneId),
    a(from),
    b(approve),
  ]);

export const buildFinalizeMilestoneTx = (
  from: string,
  campaignId: bigint,
  milestoneId: number,
) =>
  buildTx(from, "finalize_milestone", [u64(campaignId), u32(milestoneId)]);

export const buildReleaseFundsTx = (
  from: string,
  campaignId: bigint,
  milestoneId: number,
) =>
  buildTx(from, "release_milestone", [
    u64(campaignId),
    u32(milestoneId),
    a(from),
  ]);

export const buildClaimRefundTx = (from: string, campaignId: bigint) =>
  buildTx(from, "claim_refund", [u64(campaignId), a(from)]);

export const buildCancelCampaignTx = (from: string, campaignId: bigint) =>
  buildTx(from, "cancel_campaign", [u64(campaignId), a(from)]);