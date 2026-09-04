"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWalletStore } from "@/lib/wallet-store";
import { useTxStore } from "@/lib/tx-store";
import { xlmToStroops } from "@/lib/stellar-utils";
import {
  // All reads now go through milestone-client → milestone contract
  fetchAllCampaigns,
  fetchCampaignById,
  fetchCampaignCount,
  fetchContribution,
  fetchBackerCampaigns,
  // All writes go through milestone-client → milestone contract
  buildCreateCampaignTx,
  buildContributeTx,
  buildCancelCampaignTx,
  submitAndPoll,
  campaignV2ToUI,
  type CampaignV2,
} from "@/lib/milestone-client";
import type { CampaignUI, CreateCampaignInput } from "@/types/index";
import { useWallet } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { toCampaignUI, qk as msQk } from "@/hooks/use-milestones";
import { parseStellarError } from "@/lib/stellar-utils";

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const campaignKeys = {
  all: ["campaigns"] as const,
  count: ["campaigns", "count"] as const,
  detail: (id: string) => ["campaigns", id] as const,
  backer: (addr: string) => ["campaigns", "backer", addr] as const,
  contribution: (campaignId: string, addr: string) =>
    ["campaigns", "contribution", campaignId, addr] as const,
};

// ─── All Campaigns ────────────────────────────────────────────────────────────

/** Fetches ALL campaigns from the milestone contract and converts to CampaignUI type. */
export function useCampaigns() {
  return useQuery({
    queryKey: campaignKeys.all,
    queryFn: async (): Promise<CampaignUI[]> => {
      const campaigns = await fetchAllCampaigns();
      return campaigns.map(toCampaignUI);
    },
    staleTime: 30_000,
    retry: 2,
  });
}

// ─── Campaign Count ───────────────────────────────────────────────────────────

export function useCampaignCount() {
  return useQuery({
    queryKey: campaignKeys.count,
    queryFn: fetchCampaignCount,
    staleTime: 30_000,
  });
}

// ─── Single Campaign ──────────────────────────────────────────────────────────

export function useCampaign(id: string | bigint) {
  const idStr = String(id);
  return useQuery({
    queryKey: campaignKeys.detail(idStr),
    queryFn: async (): Promise<CampaignUI> => {
      const c = await fetchCampaignById(BigInt(idStr));
      return toCampaignUI(c);
    },
    enabled: !!id && id !== "0" && id !== 0n,
    staleTime: 20_000,
  });
}

// ─── Backer Campaigns ─────────────────────────────────────────────────────────

export function useBackerCampaigns(address: string) {
  return useQuery({
    queryKey: campaignKeys.backer(address),
    queryFn: async (): Promise<bigint[]> => {
      return fetchBackerCampaigns(address);
    },
    enabled: !!address,
    staleTime: 30_000,
  });
}

/**
 * useMyBackedCampaigns — returns the list of campaign IDs backed by the
 * currently connected wallet (no address argument needed).
 */
export function useMyBackedCampaigns() {
  const { address } = useWalletStore();
  return useQuery({
    queryKey: campaignKeys.backer(address ?? ""),
    queryFn: async (): Promise<string[]> => {
      if (!address) return [];
      const ids = await fetchBackerCampaigns(address);
      return ids.map(String);
    },
    enabled: !!address,
    staleTime: 30_000,
  });
}

// ─── Contribution ─────────────────────────────────────────────────────────────

export function useContribution(campaignId: string, address: string) {
  return useQuery({
    queryKey: campaignKeys.contribution(campaignId, address),
    queryFn: () => fetchContribution(BigInt(campaignId), address),
    enabled: !!campaignId && !!address,
    staleTime: 30_000,
  });
}

/**
 * useMyContribution — fetches the connected wallet's contribution for a specific
 * campaign (bigint campaign ID accepted for backwards compat with campaign detail page).
 */
export function useMyContribution(campaignId: string | bigint) {
  const { address } = useWalletStore();
  const idStr = String(campaignId);
  return useQuery({
    queryKey: campaignKeys.contribution(idStr, address ?? ""),
    queryFn: () => fetchContribution(BigInt(idStr), address!),
    enabled: !!address && !!campaignId && campaignId !== "0" && campaignId !== 0n,
    staleTime: 30_000,
  });
}

// ─── Create Campaign ──────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const { addTransaction, updateTransaction } = useTxStore();
  const { signTransaction } = useWallet();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      if (!address) throw new Error("Wallet not connected");

      const goalStroops = xlmToStroops(input.goalXLM);
      const durationSeconds = BigInt(input.durationDays * 86_400);

      // buildCreateCampaignTx targets the milestone contract via CONTRACT_CONFIG
      const txXdr = await buildCreateCampaignTx(
        address,
        input.title,
        input.description,
        goalStroops,
        durationSeconds,
      );

      const signedXdr = await signTransaction(txXdr);

      const txId = addTransaction({
        type: "create_campaign",
        status: "pending",
        from: address,
      });

      const { hash, ledger } = await submitAndPoll(signedXdr, (status) => {
        updateTransaction(txId, {
          status:
            status === "success"
              ? "success"
              : status === "failed"
                ? "failed"
                : "pending",
        });
      });

      updateTransaction(txId, { status: "success", id: hash, ledger });
      return { hash, txId };
    },
    onSuccess: (data) => {
      // Invalidate + refetch both campaign list query keys immediately.
      // use-campaigns uses "campaigns", use-milestones uses "ms-campaigns".
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      queryClient.invalidateQueries({ queryKey: campaignKeys.count });
      queryClient.invalidateQueries({ queryKey: msQk.campaigns });
      // Force an immediate background refetch so the new campaign shows up
      // without waiting for the 30 s staleTime window.
      queryClient.refetchQueries({ queryKey: campaignKeys.all });
      queryClient.refetchQueries({ queryKey: msQk.campaigns });

      toast({
        title: "Campaign Created! 🎉",
        description: "Your campaign is now live on Stellar.",
        variant: "success",
        txHash: data.hash,
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

// ─── Contribute ───────────────────────────────────────────────────────────────

export function useContribute() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const { addTransaction, updateTransaction } = useTxStore();
  const { signTransaction } = useWallet();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      campaignId,
      amountXLM,
    }: {
      campaignId: string | bigint;
      amountXLM: number;
    }) => {
      if (!address) throw new Error("Wallet not connected");

      const amountStroops = xlmToStroops(amountXLM);
      const txXdr = await buildContributeTx(
        address,
        BigInt(campaignId),
        amountStroops,
      );
      const signedXdr = await signTransaction(txXdr);

      const txId = addTransaction({
        type: "contribute",
        status: "pending",
        from: address,
      });

      const { hash, ledger } = await submitAndPoll(signedXdr, (status) => {
        updateTransaction(txId, {
          status:
            status === "success"
              ? "success"
              : status === "failed"
                ? "failed"
                : "pending",
        });
      });

      updateTransaction(txId, { status: "success", id: hash, ledger });
      return { hash, txId };
    },
    onSuccess: (data, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(String(campaignId)) });
      toast({
        title: "Contributed Successfully! 💰",
        description: "Your funds are securely held in escrow.",
        variant: "success",
        txHash: data.hash,
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

// ─── Cancel Campaign ──────────────────────────────────────────────────────────

export function useCancelCampaign() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const { addTransaction, updateTransaction } = useTxStore();
  const { signTransaction } = useWallet();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: string | bigint) => {
      if (!address) throw new Error("Wallet not connected");

      const txXdr = await buildCancelCampaignTx(address, BigInt(campaignId));
      const signedXdr = await signTransaction(txXdr);

      const txId = addTransaction({
        type: "cancel_campaign",
        status: "pending",
        from: address,
      });

      const { hash, ledger } = await submitAndPoll(signedXdr, (status) => {
        updateTransaction(txId, {
          status:
            status === "success"
              ? "success"
              : status === "failed"
                ? "failed"
                : "pending",
        });
      });

      updateTransaction(txId, { status: "success", id: hash, ledger });
      return { hash, txId };
    },
    onSuccess: (data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(String(campaignId)) });
      toast({
        title: "Campaign Cancelled",
        variant: "default",
        txHash: data.hash,
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

// ─── Claim Funds (alias for cancel — campaigns reaching goal need funds released) ──
// The crowdfunding contract uses claim_funds; we map it to cancel for now since
// the milestone contract does not have a separate claim_funds entry point.
// This hook is kept for backwards compat with campaign detail page imports.
export function useClaimFunds() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const { addTransaction, updateTransaction } = useTxStore();
  const { signTransaction } = useWallet();

  return useMutation({
    mutationFn: async (campaignId: string | bigint) => {
      if (!address) throw new Error("Wallet not connected");
      // On the milestone contract, releasing funds goes through release_milestone.
      // Here we just invalidate so UI stays consistent.
      // Actual release happens via useMilestones → useReleaseMilestone.
      throw new Error("Use useReleaseMilestone from hooks/use-milestones for milestone releases.");
    },
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(String(campaignId)) });
    },
  });
}

// Backwards-compat aliases
export const useAllCampaigns = useCampaigns;
export const useFetchCampaign = useCampaign;