import {
  Contract,
rpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import { CONTRACT_CONFIG } from "./contract-config";
import type { Campaign, CampaignStatus, ContractEvent, EventType } from "@/types";

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

function toScString(env: unknown, s: string) {
  return nativeToScVal(s, { type: "string" });
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

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }
  if (!rpc.Api.isSimulationSuccess(simResult) || !simResult.result) {
    throw new Error("Simulation failed");
  }

  return simResult.result.retval;
}

// ─── Read-Only Calls ─────────────────────────────────────────────────────────

export async function fetchCampaign(campaignId: bigint): Promise<Campaign> {
  // Use a dummy address for read-only simulation
  const DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
  const result = await simulateContractCall(DUMMY, "get_campaign", [
    toScU64(campaignId),
  ]);
  return scValToCampaign(result);
}

export async function fetchCampaignCount(): Promise<bigint> {
  const DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
  const result = await simulateContractCall(DUMMY, "get_campaign_count", []);
  return scValToNative(result) as bigint;
}

export async function fetchAllCampaigns(): Promise<Campaign[]> {
  const count = await fetchCampaignCount();
  if (count === 0n) return [];

  const campaigns: Campaign[] = [];
  const fetchPromises = Array.from({ length: Number(count) }, (_, i) =>
    fetchCampaign(BigInt(i + 1)).catch(() => null),
  );

  const results = await Promise.all(fetchPromises);
  for (const r of results) {
    if (r) campaigns.push(r);
  }
  return campaigns;
}

export async function fetchContribution(
  campaignId: bigint,
  contributor: string,
): Promise<bigint> {
  const DUMMY = contributor;
  const result = await simulateContractCall(DUMMY, "get_contribution", [
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

export async function buildCreateCampaignTx(
  sourceAddress: string,
  title: string,
  description: string,
  goalStroops: bigint,
  durationSeconds: bigint,
): Promise<{ tx: string; simulationResult: rpc.Api.SimulateTransactionSuccessResponse }> {
  const server = getRpcServer();
  const contract = getContract();

  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(
      contract.call(
        "create_campaign",
        toScAddress(sourceAddress),
        nativeToScVal(title, { type: "string" }),
        nativeToScVal(description, { type: "string" }),
        toScI128(goalStroops),
        toScU64(durationSeconds),
      ),
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error("Simulation failed");
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  return { tx: preparedTx.toXDR(), simulationResult: simResult };
}

export async function buildContributeTx(
  sourceAddress: string,
  campaignId: bigint,
  amountStroops: bigint,
): Promise<{ tx: string; simulationResult: rpc.Api.SimulateTransactionSuccessResponse }> {
  const server = getRpcServer();
  const contract = getContract();

  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(
      contract.call(
        "contribute",
        toScU64(campaignId),
        toScAddress(sourceAddress),
        toScI128(amountStroops),
      ),
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error("Simulation failed");
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  return { tx: preparedTx.toXDR(), simulationResult: simResult };
}

export async function buildClaimFundsTx(
  sourceAddress: string,
  campaignId: bigint,
): Promise<{ tx: string }> {
  const server = getRpcServer();
  const contract = getContract();

  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(
      contract.call(
        "claim_funds",
        toScU64(campaignId),
        toScAddress(sourceAddress),
      ),
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error("Simulation failed");
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  return { tx: preparedTx.toXDR() };
}

export async function buildCancelCampaignTx(
  sourceAddress: string,
  campaignId: bigint,
): Promise<{ tx: string }> {
  const server = getRpcServer();
  const contract = getContract();

  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(
      contract.call(
        "cancel_campaign",
        toScU64(campaignId),
        toScAddress(sourceAddress),
      ),
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error("Simulation failed");
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  return { tx: preparedTx.toXDR() };
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

  // Poll for completion
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const getResult = await server.getTransaction(hash);

    if (getResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      onStatus?.("success");
      return { hash, ledger: getResult.ledger };
    }
    if (getResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      const errMsg = "Transaction failed on-chain";
      onStatus?.("failed");
      throw new Error(errMsg);
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
      const topic1 = e.topic[1] ? scValToNative(e.topic[1]) : "";
      const values = e.value ? (scValToNative(e.value) as unknown[]) : [];

      let campaignId = 0n;
      let actor = "";
      let amount: bigint | undefined;

      if (Array.isArray(values)) {
        campaignId = typeof values[0] === "bigint" ? values[0] : BigInt(String(values[0] || 0));
        actor = String(values[1] || "");
        amount = values[2] !== undefined ? BigInt(String(values[2])) : undefined;
      }

      const eventType = String(topic0) as EventType;

      return {
        id: `${e.txHash}-${idx}`,
        type: eventType,
        campaignId,
        actor,
        amount,
        timestamp: Date.now(), // Approximate; ledger timestamp not directly available
        txHash: e.txHash,
        ledger: e.ledger,
      } as ContractEvent;
    });
  } catch {
    return [];
  }
}

// ─── SC Val Parser ────────────────────────────────────────────────────────────

function scValToCampaign(val: xdr.ScVal): Campaign {
  const raw = scValToNative(val) as Record<string, unknown>;

  const statusRaw = raw.status as Record<string, unknown> | string;
  let status: CampaignStatus = "Active";
  if (typeof statusRaw === "object" && statusRaw !== null) {
    const key = Object.keys(statusRaw)[0];
    status = key as CampaignStatus;
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
    const xlm = data.balances?.find((b: { asset_type: string }) => b.asset_type === "native");
    return xlm?.balance || "0";
  } catch {
    return "0";
  }
}
