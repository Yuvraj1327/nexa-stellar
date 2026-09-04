/**
 * flowlance-client.ts — Re-exports from milestone-client.ts
 *
 * All pages/hooks that used to import from flowlance-client now get the same
 * functions pointing to the MILESTONE contract.
 *
 * This file exists only for backwards compatibility with import paths.
 */

export {
  fetchCampaignById as fetchCampaignV2,
  fetchCampaignCount,
  fetchAllCampaigns as fetchAllCampaignsV2,
  fetchMilestone,
  fetchAllMilestones,
  fetchContribution as fetchContributionV2,
  fetchHasVoted,
  fetchIsRefundClaimed,
  fetchAnalytics,
  parseCampaignV2 as parseCampaign,
  parseMilestone,
  submitAndPoll,
  buildCreateCampaignTx as buildCreateCampaignV2Tx,
  buildAddMilestoneTx,
  buildContributeTx as buildContributeV2Tx,
  buildStartCampaignTx,
  buildSubmitMilestoneTx,
  buildVoteMilestoneTx,
  buildFinalizeMilestoneTx,
  buildReleaseFundsTx,
  buildClaimRefundTx,
  buildCancelCampaignTx as buildCancelCampaignV2Tx,
  type CampaignV2,
  type Milestone,
  type MilestoneStatus,
  type AnalyticsData,
} from "@/lib/milestone-client";