/**
 * soroban-client.ts — Re-exports from milestone-client.ts
 *
 * All hooks that used to import from soroban-client now get the same
 * functions, but they all point to the MILESTONE contract.
 *
 * This file exists only for backwards compatibility with import paths.
 * Do NOT add separate contract logic here.
 */

export {
  // Read functions
  fetchCampaignById as fetchCampaign,
  fetchCampaignCount,
  fetchAllCampaigns as fetchAllCampaigns,
  fetchContribution,
  fetchBackerCampaigns,
  fetchContractEvents,
  fetchXLMBalance,
  // Write functions
  buildCreateCampaignTx,
  buildContributeTx,
  buildCancelCampaignTx,
  // Submit
  submitAndPoll as submitAndTrack,
  // Types
  type CampaignV2,
  type Milestone,
  type AnalyticsData,
} from "@/lib/milestone-client";

// submitAndTrack alias (some hooks use this name)
export { submitAndPoll } from "@/lib/milestone-client";