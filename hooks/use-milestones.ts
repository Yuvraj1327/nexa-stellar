"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllCampaigns,
  fetchCampaignById as fetchCampaign,
  fetchAllMilestones,
  fetchMilestone,
  fetchContribution,
  fetchHasVoted,
  fetchIsRefundClaimed,
  fetchBackerCampaigns,
  fetchAnalytics,
  buildCreateCampaignTx,
  buildAddMilestoneTx,
  buildContributeTx,
  buildStartCampaignTx,
  buildSubmitMilestoneTx,
  buildVoteMilestoneTx as buildVoteTx,
  buildFinalizeMilestoneTx,
  buildReleaseFundsTx as buildReleaseMilestoneTx,
  buildClaimRefundTx,
  buildCancelCampaignTx,
  submitAndPoll,
} from "@/lib/milestone-client";
import { useTxStore } from "@/lib/tx-store";
import { useWallet } from "./use-wallet";
import { useToast } from "./use-toast";
import { xlmToStroops, stroopsToXLM, parseStellarError } from "@/lib/stellar-utils";
import type { CampaignUI, MilestoneUI, TxType } from "@/types/index";

export function toCampaignUI(c: Awaited<ReturnType<typeof fetchCampaign>>): CampaignUI {
  const now = Math.floor(Date.now() / 1000);
  const deadline = Number(c.deadline);
  const daysLeft = Math.max(0, Math.ceil((deadline - now) / 86400));
  return {
    ...c,
    goalXLM: stroopsToXLM(c.goal),
    raisedXLM: stroopsToXLM(c.raised),
    escrowedXLM: stroopsToXLM(c.escrowed ?? 0n),
    releasedXLM: stroopsToXLM(c.released ?? 0n),
    // Explicitly set so CampaignUI.milestoneCount is `number`, not `number | undefined`.
    // milestone-client always populates this from on-chain data (Number(r.milestone_count ?? 0)).
    milestoneCount: c.milestoneCount ?? 0,
    progress: c.goal > 0n ? Math.min(100, Math.round(Number((c.raised * 1000n) / c.goal) / 10)) : 0,
    daysLeft,
    isExpired: daysLeft === 0,
  };
}

export function toMilestoneUI(ms: Awaited<ReturnType<typeof fetchMilestone>>): MilestoneUI {
  const now = Math.floor(Date.now() / 1000);
  const deadline = Number(ms.voteDeadline);
  const isVotingOpen = ms.status === "Voting" && now < deadline;
  const totalVotes = Number(ms.voteYes + ms.voteNo);
  const approvalPct = totalVotes > 0 ? Math.round((Number(ms.voteYes) / totalVotes) * 100) : 0;
  const secLeft = Math.max(0, deadline - now);
  const h = Math.floor(secLeft / 3600);
  const m = Math.floor((secLeft % 3600) / 60);
  const timeLeft = h > 24 ? `${Math.ceil(h / 24)}d left` : h > 0 ? `${h}h ${m}m left` : m > 0 ? `${m}m left` : ms.status === "Voting" ? "Voting ended" : "";
  // Status types now align (types/index MilestoneStatus includes "Submitted")
  return { ...ms, amountXLM: stroopsToXLM(ms.amount), approvalPct, timeLeft, isVotingOpen };
}

export const qk = {
  campaigns: ["ms-campaigns"] as const,
  campaign: (id: bigint) => ["ms-campaign", id.toString()] as const,
  milestones: (id: bigint) => ["ms-milestones", id.toString()] as const,
  contribution: (cid: bigint, addr: string) => ["ms-contrib", cid.toString(), addr] as const,
  hasVoted: (cid: bigint, mid: number, addr: string) => ["ms-voted", cid.toString(), mid, addr] as const,
  refundClaimed: (cid: bigint, addr: string) => ["ms-refund", cid.toString(), addr] as const,
  backerCampaigns: (addr: string) => ["ms-backer", addr] as const,
  analytics: ["ms-analytics"] as const,
  events: ["ms-events"] as const,
};

export function useCampaigns() {
  return useQuery({
    queryKey: qk.campaigns,
    queryFn: async () => (await fetchAllCampaigns()).map(toCampaignUI),
    refetchInterval: 12_000,
    staleTime: 6_000,
  });
}

export function useCampaign(id: bigint) {
  return useQuery({
    queryKey: qk.campaign(id),
    queryFn: async () => toCampaignUI(await fetchCampaign(id)),
    enabled: id > 0n,
    refetchInterval: 10_000,
  });
}

export function useMilestones(campaignId: bigint, count: number) {
  return useQuery({
    queryKey: qk.milestones(campaignId),
    queryFn: async () => (await fetchAllMilestones(campaignId, count)).map(toMilestoneUI),
    enabled: campaignId > 0n && count > 0,
    refetchInterval: 10_000,
  });
}

export function useContribution(campaignId: bigint) {
  const { address } = useWallet();
  return useQuery({
    queryKey: qk.contribution(campaignId, address || ""),
    queryFn: () => fetchContribution(campaignId, address!),
    enabled: !!address && campaignId > 0n,
    refetchInterval: 15_000,
  });
}

export function useHasVoted(campaignId: bigint, milestoneId: number) {
  const { address } = useWallet();
  return useQuery({
    queryKey: qk.hasVoted(campaignId, milestoneId, address || ""),
    queryFn: () => fetchHasVoted(campaignId, milestoneId, address!),
    enabled: !!address && campaignId > 0n && milestoneId > 0,
  });
}

export function useIsRefundClaimed(campaignId: bigint) {
  const { address } = useWallet();
  return useQuery({
    queryKey: qk.refundClaimed(campaignId, address || ""),
    queryFn: () => fetchIsRefundClaimed(campaignId, address!),
    enabled: !!address && campaignId > 0n,
  });
}

export function useBackerCampaigns() {
  const { address } = useWallet();
  return useQuery({
    queryKey: qk.backerCampaigns(address || ""),
    queryFn: () => fetchBackerCampaigns(address!),
    enabled: !!address,
    refetchInterval: 20_000,
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: qk.analytics,
    queryFn: fetchAnalytics,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

function useMutate(txType: TxType) {
  const { address, signTransaction } = useWallet();
  const { addTransaction, updateTransaction } = useTxStore();
  const { toast } = useToast();
  return {
    address,
    exec: async (buildFn: () => Promise<string>, options?: { campaignId?: bigint; milestoneId?: number; amount?: bigint }) => {
      if (!address) throw new Error("Wallet not connected");
      const txXdr = await buildFn();
      const signed = await signTransaction(txXdr);
      const localId = addTransaction({ type: txType, status: "pending", from: address, campaignId: options?.campaignId, milestoneId: options?.milestoneId, amount: options?.amount });
      const { hash, ledger } = await submitAndPoll(signed, (s) => {
        updateTransaction(localId, { status: s === "success" ? "success" : s === "failed" ? "failed" : "pending" });
      });
      updateTransaction(localId, { status: "success", id: hash, ledger });
      return { hash, localId };
    },
    toast,
  };
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  const m = useMutate("create_campaign");
  return useMutation({
    mutationFn: async (input: { title: string; description: string; goalXLM: number; durationDays: number }) => {
      const { hash } = await m.exec(() => buildCreateCampaignTx(m.address!, input.title, input.description, xlmToStroops(input.goalXLM), BigInt(input.durationDays * 86_400)));
      return hash;
    },
    onSuccess: (hash) => { qc.invalidateQueries({ queryKey: qk.campaigns }); qc.invalidateQueries({ queryKey: qk.analytics }); m.toast({ title: "Campaign Created! 🚀", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Failed to create campaign", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useAddMilestone() {
  const qc = useQueryClient();
  const m = useMutate("add_milestone");
  return useMutation({
    mutationFn: async (input: { campaignId: bigint; title: string; description: string; amountXLM: number }) => {
      const { hash } = await m.exec(() => buildAddMilestoneTx(m.address!, input.campaignId, input.title, input.description, xlmToStroops(input.amountXLM)), { campaignId: input.campaignId });
      return hash;
    },
    onSuccess: (hash, vars) => { qc.invalidateQueries({ queryKey: qk.campaign(vars.campaignId) }); qc.invalidateQueries({ queryKey: qk.milestones(vars.campaignId) }); m.toast({ title: "Milestone Added! 📋", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Failed to add milestone", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useContribute() {
  const qc = useQueryClient();
  const m = useMutate("contribute");
  return useMutation({
    mutationFn: async (input: { campaignId: bigint; amountXLM: number }) => {
      const stroops = xlmToStroops(input.amountXLM);
      const { hash } = await m.exec(() => buildContributeTx(m.address!, input.campaignId, stroops), { campaignId: input.campaignId, amount: stroops });
      return hash;
    },
    onSuccess: (hash, vars) => { qc.invalidateQueries({ queryKey: qk.campaign(vars.campaignId) }); qc.invalidateQueries({ queryKey: qk.campaigns }); qc.invalidateQueries({ queryKey: qk.contribution(vars.campaignId, m.address || "") }); qc.invalidateQueries({ queryKey: qk.analytics }); m.toast({ title: "Contributed! 💰 Funds in escrow", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Contribution failed", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useStartCampaign() {
  const qc = useQueryClient();
  const m = useMutate("start_campaign");
  return useMutation({
    mutationFn: async (campaignId: bigint) => {
      const { hash } = await m.exec(() => buildStartCampaignTx(m.address!, campaignId), { campaignId });
      return hash;
    },
    onSuccess: (hash, campaignId) => { qc.invalidateQueries({ queryKey: qk.campaign(campaignId) }); m.toast({ title: "Campaign Started! ⚡", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Failed to start", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useSubmitMilestone() {
  const qc = useQueryClient();
  const m = useMutate("submit_milestone");
  return useMutation({
    mutationFn: async (input: { campaignId: bigint; milestoneId: number; proofUrl: string }) => {
      const { hash } = await m.exec(() => buildSubmitMilestoneTx(m.address!, input.campaignId, input.milestoneId, input.proofUrl), { campaignId: input.campaignId, milestoneId: input.milestoneId });
      return hash;
    },
    onSuccess: (hash, vars) => { qc.invalidateQueries({ queryKey: qk.milestones(vars.campaignId) }); m.toast({ title: "Proof submitted! Voting open 🗳️", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Submission failed", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useVoteMilestone() {
  const qc = useQueryClient();
  const m = useMutate("vote_milestone");
  return useMutation({
    mutationFn: async (input: { campaignId: bigint; milestoneId: number; approve: boolean }) => {
      const { hash } = await m.exec(() => buildVoteTx(m.address!, input.campaignId, input.milestoneId, input.approve), { campaignId: input.campaignId, milestoneId: input.milestoneId });
      return hash;
    },
    onSuccess: (hash, vars) => { qc.invalidateQueries({ queryKey: qk.milestones(vars.campaignId) }); qc.invalidateQueries({ queryKey: qk.hasVoted(vars.campaignId, vars.milestoneId, m.address || "") }); m.toast({ title: vars.approve ? "Voted YES ✅" : "Voted NO ❌", description: "Recorded on-chain", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Vote failed", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useFinalizeMilestone() {
  const qc = useQueryClient();
  const m = useMutate("vote_milestone");
  return useMutation({
    mutationFn: async (input: { campaignId: bigint; milestoneId: number }) => {
      const { hash } = await m.exec(() => buildFinalizeMilestoneTx(m.address!, input.campaignId, input.milestoneId), { campaignId: input.campaignId, milestoneId: input.milestoneId });
      return hash;
    },
    onSuccess: (hash, vars) => { qc.invalidateQueries({ queryKey: qk.milestones(vars.campaignId) }); qc.invalidateQueries({ queryKey: qk.campaign(vars.campaignId) }); m.toast({ title: "Voting Finalized 🏁", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Finalize failed", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useReleaseMilestone() {
  const qc = useQueryClient();
  const m = useMutate("release_milestone");
  return useMutation({
    mutationFn: async (input: { campaignId: bigint; milestoneId: number }) => {
      const { hash } = await m.exec(() => buildReleaseMilestoneTx(m.address!, input.campaignId, input.milestoneId), { campaignId: input.campaignId, milestoneId: input.milestoneId });
      return hash;
    },
    onSuccess: (hash, vars) => { qc.invalidateQueries({ queryKey: qk.campaign(vars.campaignId) }); qc.invalidateQueries({ queryKey: qk.milestones(vars.campaignId) }); qc.invalidateQueries({ queryKey: qk.analytics }); m.toast({ title: "Funds Released! 💸", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Release failed", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useClaimRefund() {
  const qc = useQueryClient();
  const m = useMutate("claim_refund");
  return useMutation({
    mutationFn: async (campaignId: bigint) => {
      const { hash } = await m.exec(() => buildClaimRefundTx(m.address!, campaignId), { campaignId });
      return hash;
    },
    onSuccess: (hash, campaignId) => { qc.invalidateQueries({ queryKey: qk.campaign(campaignId) }); qc.invalidateQueries({ queryKey: qk.refundClaimed(campaignId, m.address || "") }); m.toast({ title: "Refund Claimed! ↩️", variant: "success", txHash: hash }); },
    onError: (err) => m.toast({ title: "Refund failed", description: parseStellarError(err), variant: "destructive" }),
  });
}

export function useCancelCampaign() {
  const qc = useQueryClient();
  const m = useMutate("cancel_campaign");
  return useMutation({
    mutationFn: async (campaignId: bigint) => {
      const { hash } = await m.exec(() => buildCancelCampaignTx(m.address!, campaignId), { campaignId });
      return hash;
    },
    onSuccess: (hash, campaignId) => { qc.invalidateQueries({ queryKey: qk.campaign(campaignId) }); qc.invalidateQueries({ queryKey: qk.campaigns }); m.toast({ title: "Campaign Cancelled", variant: "default", txHash: hash }); },
    onError: (err) => m.toast({ title: "Cancel failed", description: parseStellarError(err), variant: "destructive" }),
  });
}