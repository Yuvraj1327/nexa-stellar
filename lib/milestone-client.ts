/**
 * milestone-client.ts
 * Soroban RPC client for the Nexa Milestone escrow contract.
 * All reads use simulation; all writes return unsigned XDR for wallet signing.
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
  ContractEvent,
  EventType,
} from "@/types/index";

// ─── Config ──────────────────────────────────────────────────────────────────

const CONTRACT_ID =
  process.env.NEXT_PUBLIC_MILESTONE_CONTRACT_ID ||
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  "";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";

const PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

// Dummy public key for read-only simulations (funded testnet account)
const DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// ─── Singleton RPC ────────────────────────────────────────────────────────────

let _server: rpc.Server | null = null;

export function getMilestoneRpc(): rpc.Server {
  if (!_server) {
    _server = new rpc.Server(RPC_URL, { allowHttp: true });
  }
  return _server;
}

export function getMilestoneContract(): Contract {
  if (!CONTRACT_ID) throw new Error("NEXT_PUBLIC_MILESTONE_CONTRACT_ID not set");
  return new Contract(CONTRACT_ID);
}

// ─── ScVal Helpers ────────────────────────────────────────────────────────────

const a = (addr: string) => new Address(addr).toScVal();
const u64 = (n: bigint) => nativeToScVal(n, { type: "u64" });
const u32 = (n: number) => nativeToScVal(n, { type: "u32" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const s = (v: string) => nativeToScVal(v, { type: "string" });
const b = (v: boolean) => nativeToScVal(v, { type: "bool" });

// ─── Simulation ───────────────────────────────────────────────────────────────

async function simulate(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[],
): Promise<xdr.ScVal> {
  const server = getMilestoneRpc();
  const contract = getMilestoneContract();
  const account = await server.getAccount(sourceAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result)
    throw new Error("Simulation failed");
  return sim.result.retval;
}

// ─── Build Tx (returns unsigned XDR for wallet signing) ───────────────────────

async function buildTx(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const server = getMilestoneRpc();
  const contract = getMilestoneContract();
  const account = await server.getAccount(sourceAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
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
        "Contract simulation failed — could not decode the response. " +
        "Check your inputs and that the contract is properly initialized."
      );
    }
    throw err;
  }
  if (rpc.Api.isSimulationError(sim)) {
    // Parse contract error for user-friendly message
    const errMsg = sim.error || "Contract error";
    if (errMsg.includes("Unauthorized")) throw new Error("You are not authorized for this action");
    if (errMsg.includes("already voted")) throw new Error("You have already voted on this milestone");
    if (errMsg.includes("Only backers")) throw new Error("Only campaign backers can vote");
    if (errMsg.includes("not accepting funds")) throw new Error("Campaign is not currently accepting contributions");
    if (errMsg.includes("Minimum goal")) throw new Error("Minimum campaign goal is 1 XLM");
    if (errMsg.includes("Minimum duration")) throw new Error("Minimum campaign duration is 1 hour");
    throw new Error(errMsg);
  }
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error("Simulation failed");

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

// ─── Submit + Poll ────────────────────────────────────────────────────────────

export async function submitAndPoll(
  signedXdr: string,
  onStatus?: (status: "submitting" | "pending" | "success" | "failed") => void,
): Promise<{ hash: string; ledger?: number }> {
  const server = getMilestoneRpc();
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE);

  onStatus?.("submitting");
  const send = await server.sendTransaction(tx);

  if (send.status === "ERROR") {
    throw new Error(send.errorResult?.result()?.value()?.toString() || "Submission failed");
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
      throw new Error("Transaction failed on-chain. Check the explorer for details.");
    }
  }

  throw new Error("Transaction timeout — check Stellar Explorer for status.");
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

export async function fetchCampaign(id: bigint): Promise<Campaign> {
  return parseCampaign(await simulate(DUMMY, "get_campaign", [u64(id)]));
}

export async function fetchCampaignCount(): Promise<bigint> {
  return scValToNative(await simulate(DUMMY, "get_campaign_count", [])) as bigint;
}

export async function fetchAllCampaigns(): Promise<Campaign[]> {
  const count = await fetchCampaignCount();
  if (count === 0n) return [];
  const results = await Promise.all(
    Array.from({ length: Number(count) }, (_, i) =>
      fetchCampaign(BigInt(i + 1)).catch(() => null),
    ),
  );
  return results.filter(Boolean) as Campaign[];
}

export async function fetchMilestone(
  campaignId: bigint,
  milestoneId: number,
): Promise<Milestone> {
  return parseMilestone(
    await simulate(DUMMY, "get_milestone", [u64(campaignId), u32(milestoneId)]),
  );
}

export async function fetchAllMilestones(
  campaignId: bigint,
  count: number,
): Promise<Milestone[]> {
  if (count === 0) return [];
  const results = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      fetchMilestone(campaignId, i + 1).catch(() => null),
    ),
  );
  return results.filter(Boolean) as Milestone[];
}

export async function fetchContribution(
  campaignId: bigint,
  backer: string,
): Promise<bigint> {
  return scValToNative(
    await simulate(DUMMY, "get_contribution", [u64(campaignId), a(backer)]),
  ) as bigint;
}

export async function fetchHasVoted(
  campaignId: bigint,
  milestoneId: number,
  voter: string,
): Promise<boolean> {
  return scValToNative(
    await simulate(DUMMY, "has_voted", [u64(campaignId), u32(milestoneId), a(voter)]),
  ) as boolean;
}

export async function fetchIsRefundClaimed(
  campaignId: bigint,
  backer: string,
): Promise<boolean> {
  return scValToNative(
    await simulate(DUMMY, "is_refund_claimed", [u64(campaignId), a(backer)]),
  ) as boolean;
}

export async function fetchBackerCampaigns(backer: string): Promise<bigint[]> {
  const val = await simulate(DUMMY, "get_backer_campaigns", [a(backer)]);
  return (scValToNative(val) as bigint[]) || [];
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
  const campaigns = await fetchAllCampaigns();
  let totalRaised = 0n, totalEscrowed = 0n, totalReleased = 0n;
  let totalBackers = 0n, totalMilestones = 0;
  let approved = 0, rejected = 0, pending = 0, completed = 0, failed = 0, active = 0, funded = 0;

  for (const c of campaigns) {
    totalRaised += c.raised;
    totalEscrowed += c.escrowed ?? 0n;
    totalReleased += c.released ?? 0n;
    totalBackers += c.backerCount;
    totalMilestones += c.milestoneCount ?? 0;
    if (c.status === "Completed" || c.status === "Successful") completed++;
    else if (c.status === "Failed") failed++;
    else if (c.status === "Active") active++;
    else if (c.status === "Funded") funded++;

    try {
      const mss = await fetchAllMilestones(c.id, c.milestoneCount ?? 0);
      for (const ms of mss) {
        if (ms.status === "Approved" || ms.status === "Released") approved++;
        else if (ms.status === "Rejected") rejected++;
        else if (ms.status === "Pending" || ms.status === "Voting") pending++;
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
    approvedMilestones: approved,
    rejectedMilestones: rejected,
    pendingMilestones: pending,
    successRate: n > 0 ? Math.round((completed / n) * 100) : 0,
    avgFundingXLM: n > 0 ? Math.round(Number(totalRaised) / 10_000_000 / n) : 0,
  };
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function fetchMilestoneEvents(
  startLedger?: number,
): Promise<ContractEvent[]> {
  const server = getMilestoneRpc();
  try {
    const res = await server.getEvents({
      startLedger: startLedger || undefined,
      filters: [{ type: "contract", contractIds: [CONTRACT_ID] }],
      limit: 100,
    });

    return res.events.map((e, idx) => {
      const topic0 = e.topic[0] ? String(scValToNative(e.topic[0])) : "";
      const values = e.value ? (scValToNative(e.value) as unknown[]) : [];
      let campaignId = 0n, actor = "", amount: bigint | undefined;
      if (Array.isArray(values)) {
        campaignId = typeof values[0] === "bigint" ? values[0] : BigInt(String(values[0] || 0));
        actor = String(values[1] || "");
        if (values[2] !== undefined) {
          try { amount = BigInt(String(values[2])); } catch {}
        }
      }
      return {
        id: `${e.txHash}-${idx}`,
        type: topic0 as EventType,
        campaignId,
        actor,
        amount,
        timestamp: Date.now(),
        txHash: e.txHash,
        ledger: e.ledger,
      } as ContractEvent;
    });
  } catch {
    return [];
  }
}

// ─── Transaction Builders ─────────────────────────────────────────────────────

export const buildCreateCampaignTx = (
  from: string, title: string, description: string,
  goalStroops: bigint, durationSec: bigint,
) => buildTx(from, "create_campaign", [a(from), s(title), s(description), i128(goalStroops), u64(durationSec)]);

export const buildAddMilestoneTx = (
  from: string, campaignId: bigint, title: string, description: string, amountStroops: bigint,
) => buildTx(from, "add_milestone", [u64(campaignId), a(from), s(title), s(description), i128(amountStroops)]);

export const buildContributeTx = (
  from: string, campaignId: bigint, amountStroops: bigint,
) => buildTx(from, "contribute", [u64(campaignId), a(from), i128(amountStroops)]);

export const buildStartCampaignTx = (
  from: string, campaignId: bigint,
) => buildTx(from, "start_campaign", [u64(campaignId), a(from)]);

export const buildSubmitMilestoneTx = (
  from: string, campaignId: bigint, milestoneId: number, proofUrl: string,
) => buildTx(from, "submit_milestone", [u64(campaignId), u32(milestoneId), a(from), s(proofUrl)]);

export const buildVoteTx = (
  from: string, campaignId: bigint, milestoneId: number, approve: boolean,
) => buildTx(from, "vote_milestone", [u64(campaignId), u32(milestoneId), a(from), b(approve)]);

export const buildFinalizeMilestoneTx = (
  from: string, campaignId: bigint, milestoneId: number,
) => buildTx(from, "finalize_milestone", [u64(campaignId), u32(milestoneId)]);

export const buildReleaseMilestoneTx = (
  from: string, campaignId: bigint, milestoneId: number,
) => buildTx(from, "release_milestone", [u64(campaignId), u32(milestoneId), a(from)]);

export const buildClaimRefundTx = (
  from: string, campaignId: bigint,
) => buildTx(from, "claim_refund", [u64(campaignId), a(from)]);

export const buildCancelCampaignTx = (
  from: string, campaignId: bigint,
) => buildTx(from, "cancel_campaign", [u64(campaignId), a(from)]);