"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllCampaigns,
  fetchCampaign,
  fetchCampaignCount,
  fetchContribution,
  fetchBackerCampaigns,
  buildCreateCampaignTx,
  buildContributeTx,
  buildClaimFundsTx,
  buildCancelCampaignTx,
  submitAndTrack,
} from "@/lib/soroban-client";
import { useTxStore } from "@/lib/tx-store";
import { useWallet } from "@/hooks/use-wallet";
import {
  xlmToStroops,
  stroopsToXLM,
  calcProgress,
  calcDaysLeft,
  parseStellarError,
} from "@/lib/stellar-utils";
import type { CampaignUI, CreateCampaignInput } from "@/types/index";
import { useToast } from "@/hooks/use-toast";

const POLL_INTERVAL = 10_000;

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const campaignKeys = {
  all: ["campaigns"] as const,
  lists: () => [...campaignKeys.all, "list"] as const,
  detail: (id: bigint) => [...campaignKeys.all, "detail", id.toString()] as const,
  count: () => [...campaignKeys.all, "count"] as const,
  contribution: (campaignId: bigint, address: string) =>
    [...campaignKeys.all, "contribution", campaignId.toString(), address] as const,
  backerCampaigns: (address: string) =>
    [...campaignKeys.all, "backer", address] as const,
};

// ─── UI Transform ─────────────────────────────────────────────────────────────

function toCampaignUI(c: Awaited<ReturnType<typeof fetchCampaign>>): CampaignUI {
  return {
    ...c,
    goalXLM: stroopsToXLM(c.goal),
    raisedXLM: stroopsToXLM(c.raised),
    // Level 1/2 crowdfunding contract has no escrow/release mechanism.
    // c.escrowed and c.released are optional on Campaign (0n when absent).
    // We resolve them to 0 here — accurate for L1/2, non-zero only for L3/4.
    escrowedXLM: stroopsToXLM(c.escrowed ?? 0n),
    releasedXLM: stroopsToXLM(c.released ?? 0n),
    // Explicitly set so CampaignUI.milestoneCount is `number`, not `number | undefined`.
    // L1/2 crowdfunding contract returns no milestone data; 0 is the accurate value.
    milestoneCount: c.milestoneCount ?? 0,
    progress: calcProgress(c.raised, c.goal),
    daysLeft: calcDaysLeft(c.deadline),
    isExpired: calcDaysLeft(c.deadline) === 0,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useCampaigns() {
  return useQuery({
    queryKey: campaignKeys.lists(),
    queryFn: async () => {
      const campaigns = await fetchAllCampaigns();
      return campaigns.map(toCampaignUI);
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: 5_000,
  });
}

export function useCampaign(id: bigint) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: async () => toCampaignUI(await fetchCampaign(id)),
    refetchInterval: POLL_INTERVAL,
    staleTime: 5_000,
    enabled: id > 0n,
  });
}

export function useCampaignCount() {
  return useQuery({
    queryKey: campaignKeys.count(),
    queryFn: fetchCampaignCount,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useMyContribution(campaignId: bigint) {
  const { address } = useWallet();
  return useQuery({
    queryKey: campaignKeys.contribution(campaignId, address || ""),
    queryFn: () => fetchContribution(campaignId, address!),
    enabled: !!address && campaignId > 0n,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useMyBackedCampaigns() {
  const { address } = useWallet();
  return useQuery({
    queryKey: campaignKeys.backerCampaigns(address || ""),
    queryFn: () => fetchBackerCampaigns(address!),
    enabled: !!address,
    refetchInterval: POLL_INTERVAL,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const { address, signTransaction } = useWallet();
  const { addTransaction, updateTransaction } = useTxStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      if (!address) throw new Error("Wallet not connected");

      const goalStroops = xlmToStroops(input.goalXLM);
      const durationSeconds = BigInt(input.durationDays * 86400);

      const { tx } = await buildCreateCampaignTx(
        address,
        input.title,
        input.description,
        goalStroops,
        durationSeconds,
      );

      const signedXdr = await signTransaction(tx);

      const txId = addTransaction({
        type: "create_campaign",
        status: "pending",
        from: address,
      });

      const { hash, ledger } = await submitAndTrack(signedXdr, (status) => {
        updateTransaction(txId, {
          status: status as "pending" | "success" | "failed",
        });
      });

      updateTransaction(txId, { status: "success", id: hash, ledger });

      return { hash, txId };
    },
    onSuccess: ({ hash }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.count() });
      toast({
        title: "Campaign Created! 🎉",
        description: "Your campaign is now live on Stellar.",
        variant: "success",
        txHash: hash,
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to create campaign",
        description: parseStellarError(err),
        variant: "destructive",
      });
    },
  });
}

export function useContribute() {
  const { address, signTransaction } = useWallet();
  const { addTransaction, updateTransaction } = useTxStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      campaignId,
      amountXLM,
    }: {
      campaignId: bigint;
      amountXLM: number;
    }) => {
      if (!address) throw new Error("Wallet not connected");

      const amountStroops = xlmToStroops(amountXLM);
      const { tx } = await buildContributeTx(address, campaignId, amountStroops);
      const signedXdr = await signTransaction(tx);

      const txId = addTransaction({
        type: "contribute",
        status: "pending",
        from: address,
        campaignId,
        amount: amountStroops,
      });

      const { hash, ledger } = await submitAndTrack(signedXdr, (status) => {
        updateTransaction(txId, {
          status: status as "pending" | "success" | "failed",
        });
      });

      updateTransaction(txId, { status: "success", id: hash, ledger });

      return { hash, txId };
    },
    onSuccess: ({ hash }, vars) => {
      queryClient.invalidateQueries({
        queryKey: campaignKeys.detail(vars.campaignId),
      });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: campaignKeys.contribution(vars.campaignId, address || ""),
      });
      toast({
        title: "Contribution Successful! ✨",
        description: `You backed this campaign with ${vars.amountXLM} XLM.`,
        variant: "success",
        txHash: hash,
      });
    },
    onError: (err) => {
      toast({
        title: "Contribution failed",
        description: parseStellarError(err),
        variant: "destructive",
      });
    },
  });
}

export function useClaimFunds() {
  const { address, signTransaction } = useWallet();
  const { addTransaction, updateTransaction } = useTxStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: bigint) => {
      if (!address) throw new Error("Wallet not connected");

      const { tx } = await buildClaimFundsTx(address, campaignId);
      const signedXdr = await signTransaction(tx);

      const txId = addTransaction({
        type: "claim_funds",
        status: "pending",
        from: address,
        campaignId,
      });

      const { hash, ledger } = await submitAndTrack(signedXdr, (status) => {
        updateTransaction(txId, {
          status: status as "pending" | "success" | "failed",
        });
      });

      updateTransaction(txId, { status: "success", id: hash, ledger });

      return { hash };
    },
    onSuccess: ({ hash }, campaignId) => {
      queryClient.invalidateQueries({
        queryKey: campaignKeys.detail(campaignId),
      });
      toast({
        title: "Funds Claimed! 💰",
        description: "Campaign funds have been sent to your wallet.",
        variant: "success",
        txHash: hash,
      });
    },
    onError: (err) => {
      toast({
        title: "Claim failed",
        description: parseStellarError(err),
        variant: "destructive",
      });
    },
  });
}

export function useCancelCampaign() {
  const { address, signTransaction } = useWallet();
  const { addTransaction, updateTransaction } = useTxStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: bigint) => {
      if (!address) throw new Error("Wallet not connected");

      const { tx } = await buildCancelCampaignTx(address, campaignId);
      const signedXdr = await signTransaction(tx);

      const txId = addTransaction({
        type: "cancel_campaign",
        status: "pending",
        from: address,
        campaignId,
      });

      const { hash, ledger } = await submitAndTrack(signedXdr, (status) => {
        updateTransaction(txId, {
          status: status as "pending" | "success" | "failed",
        });
      });

      updateTransaction(txId, { status: "success", id: hash, ledger });

      return { hash };
    },
    onSuccess: ({ hash }, campaignId) => {
      queryClient.invalidateQueries({
        queryKey: campaignKeys.detail(campaignId),
      });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      toast({
        title: "Campaign Cancelled",
        description: "Your campaign has been cancelled.",
        txHash: hash,
      });
    },
    onError: (err) => {
      toast({
        title: "Cancel failed",
        description: parseStellarError(err),
        variant: "destructive",
      });
    },
  });
}