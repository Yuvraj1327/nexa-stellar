"use client";

import { useState, useCallback } from "react";
import { useWallet } from "./use-wallet";
import { useTxStore } from "@/lib/tx-store";
import {
  buildSendXLMTx,
  submitPayment,
  isValidStellarAddress,
} from "@/lib/payment-client";
import { parseStellarError, xlmToStroops } from "@/lib/stellar-utils";
import { useToast } from "./use-toast";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { CONTRACT_CONFIG } from "@/lib/contract-config";

export type SendState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "awaiting_signature" }
  | { status: "submitting" }
  | { status: "success"; hash: string; ledger: number }
  | { status: "failed"; error: string };

export function useSendPayment() {
  const { address, signTransaction, isConnected } = useWallet();
  const { addTransaction, updateTransaction } = useTxStore();
  const { toast } = useToast();
  const [state, setState] = useState<SendState>({ status: "idle" });

  const send = useCallback(
    async (params: { to: string; amountXLM: number; memo?: string }) => {
      if (!isConnected || !address) {
        toast({ title: "Wallet not connected", variant: "destructive" });
        return;
      }

      setState({ status: "building" });

      const txId = addTransaction({
        type: "send_payment",
        status: "pending",
        from: address,
        to: params.to,
        amount: xlmToStroops(params.amountXLM),
        id: "",
      });

      try {
        // 1. Build unsigned transaction
        setState({ status: "building" });
        const { txXdr } = await buildSendXLMTx({
          from: address,
          to: params.to,
          amountXLM: params.amountXLM,
          memo: params.memo,
        });

        // 2. Ask wallet to sign
        setState({ status: "awaiting_signature" });
        let signedXdr: string;
        try {
          signedXdr = await signTransaction(txXdr);
        } catch (err) {
          const msg = parseStellarError(err);
          // Explicitly handle user rejection
          if (
            msg.toLowerCase().includes("reject") ||
            msg.toLowerCase().includes("declined") ||
            msg.toLowerCase().includes("cancelled") ||
            msg.toLowerCase().includes("denied")
          ) {
            throw new Error("Transaction rejected by wallet. Please approve in your wallet to continue.");
          }
          throw new Error(msg);
        }

        // 3. Submit to network
        setState({ status: "submitting" });
        updateTransaction(txId, { status: "pending" });

        const networkPassphrase =
          CONTRACT_CONFIG.network === "mainnet"
            ? Networks.PUBLIC
            : Networks.TESTNET;

        // Re-build a Transaction object from signed XDR for Horizon submit
        const signedTx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
        const horizon = (await import("@/lib/payment-client")).getHorizon();
        const result = await horizon.submitTransaction(signedTx);

        const hash = result.hash;
        const ledger = (result as unknown as { ledger_attr?: number }).ledger_attr ?? 0;

        // 4. Success
        updateTransaction(txId, { status: "success", id: hash, ledger });
        setState({ status: "success", hash, ledger });

        toast({
          title: "Payment Sent! ✅",
          description: `${params.amountXLM} XLM sent successfully`,
          variant: "success",
          txHash: hash,
        });

        return hash;
      } catch (err: unknown) {
        const message = parseStellarError(err);
        updateTransaction(txId, { status: "failed", error: message });
        setState({ status: "failed", error: message });

        toast({
          title: "Payment Failed",
          description: message,
          variant: "destructive",
        });
      }
    },
    [address, isConnected, signTransaction, addTransaction, updateTransaction, toast],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, send, reset };
}
