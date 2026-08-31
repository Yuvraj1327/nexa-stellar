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
  CampaignV2,
  CampaignStatus,
  Milestone,
  MilestoneStatus,
  AnalyticsData,
} from "@/types/milestone";

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

// ─── Dummy address for read-only simulations ──────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addr(a: string) { return new Address(a).toScVal(); }
function u64(n: bigint) { return nativeToScVal(n, { type: "u64" }); }
function u32(n: number) { return nativeToScVal(n, { type: "u32" }); }
function i128(n: bigint) { return nativeToScVal(n, { type: "i128" }); }
function str(env: unknown, s: string) { return nativeToScVal(s, { type: "string" }); }
function bool(b: boolean) { return nativeToScVal(b, { type: "bool" }); }

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
  onStatus?: (s: string) => void,
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
  if (typeof raw === "object" && raw !== null) {
    return Object.keys(raw as object)[0] as CampaignStatus;
  }
  return (raw as string) as CampaignStatus;
}

function parseMilestoneStatus(raw: unknown): MilestoneStatus {
  if (typeof raw === "object" && raw !== null) {
    return Object.keys(raw as object)[0] as MilestoneStatus;
  }
  return (raw as string) as MilestoneStatus;
}

export function parseCampaign(val: xdr.ScVal): CampaignV2 {
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

// ─── Read-Only Calls ─────────────────────────────────────────────────────────

export async function fetchCampaignV2(id: bigint): Promise<CampaignV2> {
  return parseCampaign(await simulate("get_campaign", [u64(id)]));
}

export async function fetchCampaignCount(): Promise<bigint> {
  return scValToNative(await simulate("get_campaign_count", [])) as bigint;
}

export async function fetchAllCampaignsV2(): Promise<CampaignV2[]> {
  const count = await fetchCampaignCount();
  if (count === 0n) return [];
  const results = await Promise.all(
    Array.from({ length: Number(count) }, (_, i) =>
      fetchCampaignV2(BigInt(i + 1)).catch(() => null),
    ),
  );
  return results.filter(Boolean) as CampaignV2[];
}

export async function fetchMilestone(
  campaignId: bigint,
  milestoneId: number,
): Promise<Milestone> {
  return parseMilestone(
    await simulate("get_milestone", [u64(campaignId), u32(milestoneId)]),
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

export async function fetchContributionV2(
  campaignId: bigint,
  backer: string,
): Promise<bigint> {
  return scValToNative(
    await simulate("get_contribution", [u64(campaignId), addr(backer)]),
  ) as bigint;
}

export async function fetchHasVoted(
  campaignId: bigint,
  milestoneId: number,
  voter: string,
): Promise<boolean> {
  return scValToNative(
    await simulate("has_voted", [u64(campaignId), u32(milestoneId), addr(voter)]),
  ) as boolean;
}

export async function fetchIsRefundClaimed(
  campaignId: bigint,
  backer: string,
): Promise<boolean> {
  return scValToNative(
    await simulate("is_refund_claimed", [u64(campaignId), addr(backer)]),
  ) as boolean;
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

  let totalRaised = 0n;
  let totalEscrowed = 0n;
  let totalReleased = 0n;
  let totalBackers = 0n;
  let totalMilestones = 0;
  let approvedMilestones = 0;
  let rejectedMilestones = 0;
  let completed = 0;

  for (const c of campaigns) {
    totalRaised += c.raised;
    totalEscrowed += c.escrowed;
    totalReleased += c.released;
    totalBackers += c.backerCount;
    totalMilestones += c.milestoneCount;
    if (c.status === "Completed") completed++;

    // Fetch milestones for stats
    try {
      const mss = await fetchAllMilestones(c.id, c.milestoneCount);
      for (const ms of mss) {
        if (ms.status === "Approved" || ms.status === "Released") approvedMilestones++;
        if (ms.status === "Rejected") rejectedMilestones++;
      }
    } catch {}
  }

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === "Active").length,
    completedCampaigns: completed,
    totalRaisedXLM: Number(totalRaised) / 10_000_000,
    totalEscrowedXLM: Number(totalEscrowed) / 10_000_000,
    totalReleasedXLM: Number(totalReleased) / 10_000_000,
    totalBackers: Number(totalBackers),
    totalMilestones,
    approvedMilestones,
    rejectedMilestones,
    successRate:
      campaigns.length > 0 ? Math.round((completed / campaigns.length) * 100) : 0,
    avgFundingXLM:
      campaigns.length > 0
        ? Math.round(Number(totalRaised) / 10_000_000 / campaigns.length)
        : 0,
  };
}

// ─── Transaction Builders ─────────────────────────────────────────────────────

export async function buildCreateCampaignV2Tx(
  from: string,
  title: string,
  description: string,
  goalStroops: bigint,
  durationSeconds: bigint,
): Promise<string> {
  return buildTx(from, "create_campaign", [
    addr(from),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(description, { type: "string" }),
    i128(goalStroops),
    u64(durationSeconds),
  ]);
}

export async function buildAddMilestoneTx(
  from: string,
  campaignId: bigint,
  title: string,
  description: string,
  amountStroops: bigint,
): Promise<string> {
  return buildTx(from, "add_milestone", [
    u64(campaignId),
    addr(from),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(description, { type: "string" }),
    i128(amountStroops),
  ]);
}

export async function buildContributeV2Tx(
  from: string,
  campaignId: bigint,
  amountStroops: bigint,
): Promise<string> {
  return buildTx(from, "contribute", [
    u64(campaignId),
    addr(from),
    i128(amountStroops),
  ]);
}

export async function buildStartCampaignTx(
  from: string,
  campaignId: bigint,
): Promise<string> {
  return buildTx(from, "start_campaign", [u64(campaignId), addr(from)]);
}

export async function buildSubmitMilestoneTx(
  from: string,
  campaignId: bigint,
  milestoneId: number,
  proofUrl: string,
): Promise<string> {
  return buildTx(from, "submit_milestone", [
    u64(campaignId),
    u32(milestoneId),
    addr(from),
    nativeToScVal(proofUrl, { type: "string" }),
  ]);
}

export async function buildVoteMilestoneTx(
  from: string,
  campaignId: bigint,
  milestoneId: number,
  approve: boolean,
): Promise<string> {
  return buildTx(from, "vote_milestone", [
    u64(campaignId),
    u32(milestoneId),
    addr(from),
    bool(approve),
  ]);
}

export async function buildFinalizeMilestoneTx(
  from: string,
  campaignId: bigint,
  milestoneId: number,
): Promise<string> {
  return buildTx(from, "finalize_milestone", [
    u64(campaignId),
    u32(milestoneId),
  ]);
}

export async function buildReleaseFundsTx(
  from: string,
  campaignId: bigint,
  milestoneId: number,
): Promise<string> {
  return buildTx(from, "release_milestone_funds", [
    u64(campaignId),
    u32(milestoneId),
    addr(from),
  ]);
}

export async function buildClaimRefundTx(
  from: string,
  campaignId: bigint,
): Promise<string> {
  return buildTx(from, "claim_refund", [u64(campaignId), addr(from)]);
}

export async function buildCancelCampaignV2Tx(
  from: string,
  campaignId: bigint,
): Promise<string> {
  return buildTx(from, "cancel_campaign", [u64(campaignId), addr(from)]);
}
