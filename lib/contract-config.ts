/**
 * Central contract configuration — single source of truth.
 *
 * ALL contract reads and writes must use CONTRACT_CONFIG.milestoneContractId.
 * The milestone contract (CAVKC6G5XI52W3AWUM3MYA7TXDSNXJVZPDZSHOLVFCL7QED3BAFBZW42)
 * is the ONLY deployed contract for Nexa Stellar.
 *
 * NEXT_PUBLIC_CONTRACT_ID is kept only for backwards-compat with analytics/explorer links.
 */

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "testnet";

// ── The ONE contract that everything reads/writes to ──────────────────────────
// This is the deployed milestone escrow contract built from contracts/milestone/
export const MILESTONE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_MILESTONE_CONTRACT_ID ||
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  "";

export const CONTRACT_CONFIG = {
  /** The active milestone contract — all CRUD goes here. */
  contractId: MILESTONE_CONTRACT_ID,
  milestoneContractId: MILESTONE_CONTRACT_ID,

  network: NETWORK,
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://soroban-testnet.stellar.org",
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
    "Test SDF Network ; September 2015",
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ||
    "https://horizon-testnet.stellar.org",
  explorerBase:
    process.env.NEXT_PUBLIC_EXPLORER_BASE ||
    "https://stellar.expert/explorer/testnet",
} as const;

export type ContractConfig = typeof CONTRACT_CONFIG;