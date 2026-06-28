/**
 * payment-client.ts
 * Handles native XLM payment transactions on Stellar.
 * This satisfies the White Belt "Send XLM on Stellar Testnet" requirement.
 */

import {
  Horizon,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Asset,
  Memo,
  StrKey,
} from "@stellar/stellar-sdk";
import { CONTRACT_CONFIG } from "./contract-config";
import { xlmToStroops } from "./stellar-utils";

// ─── Horizon Client ─────────────────────────────────────────────────────────

let _horizon: Horizon.Server | null = null;

export function getHorizon(): Horizon.Server {
  if (!_horizon) {
    _horizon = new Horizon.Server(CONTRACT_CONFIG.horizonUrl, {
      allowHttp: CONTRACT_CONFIG.network === "testnet",
    });
  }
  return _horizon;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function isValidStellarAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

export interface SendXLMParams {
  from: string;
  to: string;
  amountXLM: number;
  memo?: string;
}

export interface PaymentBuildResult {
  txXdr: string;
  fee: string;
}

// ─── Build Payment Transaction ───────────────────────────────────────────────

export async function buildSendXLMTx(
  params: SendXLMParams,
): Promise<PaymentBuildResult> {
  const { from, to, amountXLM, memo } = params;

  if (!isValidStellarAddress(from)) throw new Error("Invalid sender address");
  if (!isValidStellarAddress(to)) throw new Error("Invalid recipient address");
  if (amountXLM <= 0) throw new Error("Amount must be greater than 0");
  if (from === to) throw new Error("Cannot send to your own address");

  const horizon = getHorizon();

  // Load sender account (throws if account doesn't exist / not funded)
  let account: Horizon.AccountResponse;
  try {
    account = await horizon.loadAccount(from);
  } catch {
    throw new Error("Sender account not found. Please fund your account via Friendbot first.");
  }

  // Verify recipient exists (optional but friendly)
  try {
    await horizon.loadAccount(to);
  } catch {
    throw new Error(
      "Recipient account not found on Testnet. The destination address must be activated first.",
    );
  }

  // Check sender balance
  const xlmBalance = account.balances.find(
    (b) => b.asset_type === "native",
  );
  const available = parseFloat(xlmBalance?.balance ?? "0");
  // Keep at least 1 XLM as reserve + fee buffer
  if (amountXLM + 1 > available) {
    throw new Error(
      `Insufficient balance. You have ${available.toFixed(4)} XLM, need at least ${(amountXLM + 1).toFixed(4)} XLM (including 1 XLM reserve).`,
    );
  }

  const networkPassphrase =
    CONTRACT_CONFIG.network === "mainnet"
      ? Networks.PUBLIC
      : Networks.TESTNET;

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  }).addOperation(
    Operation.payment({
      destination: to,
      asset: Asset.native(),
      amount: amountXLM.toFixed(7),
    }),
  );

  if (memo && memo.trim()) {
    txBuilder.addMemo(Memo.text(memo.trim().slice(0, 28)));
  }

  const tx = txBuilder.setTimeout(30).build();

  return {
    txXdr: tx.toXDR(),
    fee: BASE_FEE,
  };
}

// ─── Submit Payment ──────────────────────────────────────────────────────────

export async function submitPayment(
  signedXdr: string,
  onStatus?: (status: "submitting" | "success" | "failed") => void,
): Promise<{ hash: string; ledger: number }> {
  const horizon = getHorizon();
  onStatus?.("submitting");

  try {
    const result = await horizon.submitTransaction(
      // Parse the signed XDR back into a Transaction
      (() => {
        const { TransactionBuilder } = require("@stellar/stellar-sdk");
        return TransactionBuilder.fromXDR(
          signedXdr,
          CONTRACT_CONFIG.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
        );
      })(),
    );

    onStatus?.("success");
  // Line 148-151 ke paas ka code badal kar aisa karein:
return {
  hash: result.hash,
  ledger: result.ledger ?? 0, // <-- ledger_attr hata kar sirf ledger likhein
};
  } catch (err: unknown) {
    onStatus?.("failed");
    // Parse Horizon error
    const he = err as { response?: { data?: { extras?: { result_codes?: Record<string, unknown> } } } };
    const codes = he?.response?.data?.extras?.result_codes;
    if (codes) {
      const txCode = codes.transaction;
      const opCodes = codes.operations as string[] | undefined;
      if (txCode === "tx_bad_auth") throw new Error("Transaction authorization failed");
      if (opCodes?.[0] === "op_underfunded") throw new Error("Insufficient XLM balance");
      if (opCodes?.[0] === "op_no_destination")
        throw new Error("Recipient account not found on-chain");
      throw new Error(`Transaction failed: ${JSON.stringify(codes)}`);
    }
    throw err;
  }
}

// ─── Friendbot ───────────────────────────────────────────────────────────────

export async function fundWithFriendbot(address: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`,
    );
    return res.ok;
  } catch {
    return false;
  }
}
