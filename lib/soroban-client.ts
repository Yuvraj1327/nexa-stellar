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
import { CONTRACT_CONFIG } from "./contract-config";
import type { Campaign, CampaignStatus, ContractEvent, EventType } from "@/types/index";

// ─── RPC Client ──────────────────────────────────────────────────────────────

let _rpcServer: rpc.Server | null = null;

export function getRpcServer(): rpc.Server {
  if (!_rpcServer) {
    _rpcServer = new rpc.Server(CONTRACT_CONFIG.rpcUrl, {
      allowHttp: CONTRACT_CONFIG.network === "testnet",
    });
  }
  return _rpcServer;
}

// ─── Contract Instance ────────────────────────────────────────────────────────

export function getContract(): Contract {
  return new Contract(CONTRACT_CONFIG.contractId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function networkPassphrase(): string {
  return CONTRACT_CONFIG.networkPassphrase;
}

function toScAddress(address: string) {
  return new Address(address).toScVal();
}

function toScU64(n: bigint) {
  return nativeToScVal(n, { type: "u64" });
}

function toScI128(n: bigint) {
  return nativeToScVal(n, { type: "i128" });
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export async function simulateContractCall(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[],
): Promise<xdr.ScVal> {
  const server = getRpcServer();
  const contract = getContract();

  const account = await server.getAccount(sourceAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  let simResult;
  try {
    simResult = await server.simulateTransaction(tx);
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err ?? "");
    // stellar-sdk v13 cannot parse some XDR returned by newer soroban-sdk contracts.
    // Surface the raw error so the user sees something meaningful.
    if (msg.includes("Bad union switch") || msg.includes("union switch")) {
      throw new Error(
        "Contract call failed. The contract may have returned an error that could not be decoded. " +
        "Check that the contract is initialized and your inputs are valid."
      );
    }
    throw err;
  }
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }
  if (!rpc.Api.isSimulationSuccess(simResult) || !simResult.result) {
    throw new Error("Simulation failed");
  }

  return simResult.result.retval;
}

// ─── Read-Only Calls ─────────────────────────────────────────────────────────

const DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

export async function fetchCampaign(campaignId: bigint): Promise<Campaign> {
  const result = await simulateContractCall(DUMMY, "get_campaign", [
    toScU64(campaignId),
  ]);
  return scValToCampaign(result);
}

export async function fetchCampaignCount(): Promise<bigint> {
  const result = await simulateContractCall(DUMMY, "get_campaign_count", []);
  return scValToNative(result) as bigint;
}

export async function fetchAllCampaigns(): Promise<Campaign[]> {
  const count = await fetchCampaignCount();
  if (count === 0n) return [];

  const fetchPromises = Array.from({ length: Number(count) }, (_, i) =>
    fetchCampaign(BigInt(i + 1)).catch(() => null),
  );

  const results = await Promise.all(fetchPromises);
  return results.filter(Boolean) as Campaign[];
}

export async function fetchContribution(
  campaignId: bigint,
  contributor: string,
): Promise<bigint> {
  const result = await simulateContractCall(contributor, "get_contribution", [
    toScU64(campaignId),
    toScAddress(contributor),
  ]);
  return scValToNative(result) as bigint;
}

export async function fetchBackerCampaigns(backer: string): Promise<bigint[]> {
  const result = await simulateContractCall(backer, "get_backer_campaigns", [
    toScAddress(backer),
  ]);
  return (scValToNative(result) as bigint[]) || [];
}

// ─── Transaction Building ─────────────────────────────────────────────────────

async function buildAndSimulate(
  sourceAddress: string,
  operation: xdr.Operation,
): Promise<{ tx: string }> {
  const server = getRpcServer();
  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  let simResult;
  try {
    simResult = await server.simulateTransaction(tx);
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err ?? "");
    if (msg.includes("Bad union switch") || msg.includes("union switch")) {
      throw new Error(
        "Contract simulation failed. This usually means the contract returned an error " +
        "that stellar-sdk could not decode. Check your inputs and try again."
      );
    }
    throw err;
  }
  if (rpc.Api.isSimulationError(simResult)) {
    const msg = simResult.error || "Simulation failed";
    if (msg.includes("Campaign is not active")) throw new Error("Campaign is not accepting contributions");
    if (msg.includes("deadline has passed")) throw new Error("Campaign deadline has passed");
    if (msg.includes("Goal must be positive")) throw new Error("Campaign goal must be greater than 0");
    if (msg.includes("Only the creator")) throw new Error("Only the campaign creator can perform this action");
    throw new Error(msg);
  }
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error("Simulation failed");
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  return { tx: preparedTx.toXDR() };
}

export async function buildCreateCampaignTx(
  sourceAddress: string,
  title: string,
  description: string,
  goalStroops: bigint,
  durationSeconds: bigint,
): Promise<{ tx: string }> {
  const contract = getContract();
  const op = contract.call(
    "create_campaign",
    toScAddress(sourceAddress),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(description, { type: "string" }),
    toScI128(goalStroops),
    toScU64(durationSeconds),
  );
  return buildAndSimulate(sourceAddress, op);
}

export async function buildContributeTx(
  sourceAddress: string,
  campaignId: bigint,
  amountStroops: bigint,
): Promise<{ tx: string }> {
  const contract = getContract();
  const op = contract.call(
    "contribute",
    toScU64(campaignId),
    toScAddress(sourceAddress),
    toScI128(amountStroops),
  );
  return buildAndSimulate(sourceAddress, op);
}

export async function buildClaimFundsTx(
  sourceAddress: string,
  campaignId: bigint,
): Promise<{ tx: string }> {
  const contract = getContract();
  const op = contract.call(
    "claim_funds",
    toScU64(campaignId),
    toScAddress(sourceAddress),
  );
  return buildAndSimulate(sourceAddress, op);
}

export async function buildCancelCampaignTx(
  sourceAddress: string,
  campaignId: bigint,
): Promise<{ tx: string }> {
  const contract = getContract();
  const op = contract.call(
    "cancel_campaign",
    toScU64(campaignId),
    toScAddress(sourceAddress),
  );
  return buildAndSimulate(sourceAddress, op);
}

// ─── Transaction Submission & Tracking ────────────────────────────────────────

export async function submitAndTrack(
  signedXdr: string,
  onStatus?: (status: string) => void,
): Promise<{ hash: string; ledger?: number }> {
  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase());

  onStatus?.("submitting");
  const sendResult = await server.sendTransaction(tx);
  if (sendResult.status === "ERROR") {
    const err = sendResult.errorResult?.result()?.value()?.toString();
    throw new Error(err || "Transaction submission failed");
  }

  const hash = sendResult.hash;
  onStatus?.("pending");

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const getResult = await server.getTransaction(hash);

    if (getResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      onStatus?.("success");
      return { hash, ledger: getResult.ledger };
    }
    if (getResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      onStatus?.("failed");
      throw new Error("Transaction failed on-chain");
    }
  }

  throw new Error("Transaction timeout — check explorer for status");
}

// ─── Event Fetching ───────────────────────────────────────────────────────────

export async function fetchContractEvents(
  startLedger?: number,
): Promise<ContractEvent[]> {
  const server = getRpcServer();

  try {
    const eventsResult = await server.getEvents({
      startLedger: startLedger || undefined,
      filters: [
        {
          type: "contract",
          contractIds: [CONTRACT_CONFIG.contractId],
        },
      ],
      limit: 100,
    });

    return eventsResult.events.map((e, idx) => {
      const topic0 = e.topic[0] ? scValToNative(e.topic[0]) : "";
      const values = e.value ? (scValToNative(e.value) as unknown[]) : [];

      let campaignId = 0n;
      let actor = "";
      let amount: bigint | undefined;

      if (Array.isArray(values)) {
        campaignId =
          typeof values[0] === "bigint"
            ? values[0]
            : BigInt(String(values[0] || 0));
        actor = String(values[1] || "");
        if (values[2] !== undefined) {
          try {
            amount = BigInt(String(values[2]));
          } catch {}
        }
      }

      return {
        id: `${e.txHash}-${idx}`,
        type: String(topic0) as EventType,
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

// ─── SC Val → Campaign ────────────────────────────────────────────────────────

function scValToCampaign(val: xdr.ScVal): Campaign {
  const raw = scValToNative(val) as Record<string, unknown>;

  const statusRaw = raw.status as Record<string, unknown> | string;
  let status: CampaignStatus = "Active";
  if (typeof statusRaw === "object" && statusRaw !== null) {
    status = Object.keys(statusRaw)[0] as CampaignStatus;
  } else if (typeof statusRaw === "string") {
    status = statusRaw as CampaignStatus;
  }

  return {
    id: BigInt(String(raw.id ?? 0)),
    creator: String(raw.creator ?? ""),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    goal: BigInt(String(raw.goal ?? 0)),
    raised: BigInt(String(raw.raised ?? 0)),
    // The Level 1/2 crowdfunding contract has no escrow or milestone mechanism.
    // These fields are 0n/0 here — an accurate representation of L1/2 contract state.
    // The Campaign interface marks them optional so parsers for both contracts satisfy it.
    escrowed: 0n,
    released: 0n,
    milestoneCount: 0,
    deadline: BigInt(String(raw.deadline ?? 0)),
    status,
    backerCount: BigInt(String(raw.backer_count ?? 0)),
    createdAt: BigInt(String(raw.created_at ?? 0)),
  };
}

// ─── Account Balance ──────────────────────────────────────────────────────────

export async function fetchXLMBalance(address: string): Promise<string> {
  try {
    const horizonUrl = CONTRACT_CONFIG.horizonUrl;
    const res = await fetch(`${horizonUrl}/accounts/${address}`);
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