#!/usr/bin/env node
/**
 * nexa-stellar deployment script
 * Deploys the Crowdfunding contract to Stellar Testnet
 *
 * Usage:
 *   node scripts/deploy.mjs [--network testnet|mainnet]
 *
 * Prerequisites:
 *   - Rust + cargo installed
 *   - stellar CLI installed (cargo install --locked stellar-cli)
 *   - DEPLOYER_SECRET_KEY in .env.local
 */

import "dotenv/config";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Config ──────────────────────────────────────────────────────────────────

const NETWORK = process.argv.includes("--network")
  ? process.argv[process.argv.indexOf("--network") + 1]
  : "testnet";

const NETWORKS = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    explorerBase: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    rpcUrl: "https://mainnet.sorobanrpc.com",
    passphrase: "Public Global Stellar Network ; September 2015",
    explorerBase: "https://stellar.expert/explorer/public",
  },
};

const NET = NETWORKS[NETWORK];
if (!NET) {
  console.error(`Unknown network: ${NETWORK}`);
  process.exit(1);
}

const DEPLOYER_ACCOUNT = process.env.DEPLOYER_ACCOUNT || "nexa-deployer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd, { stdio: opts.silent ? "pipe" : "inherit", ...opts })
    ?.toString()
    .trim();
}

function runSilent(cmd) {
  return run(cmd, { silent: true });
}

// ─── Steps ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Deploying nexa-stellar to ${NETWORK.toUpperCase()}\n`);
  console.log("=".repeat(60));

  // 1. Setup identity
  console.log("\n📋 Step 1: Setup deployer identity");
  try {
    runSilent(`stellar keys address ${DEPLOYER_ACCOUNT}`);
    console.log(`✓ Using existing identity: ${DEPLOYER_ACCOUNT}`);
  } catch {
    console.log(`Creating new identity: ${DEPLOYER_ACCOUNT}`);
    run(`stellar keys generate --fund ${DEPLOYER_ACCOUNT} --network ${NETWORK}`);
    console.log(`✓ Identity created and funded via Friendbot`);
  }

  const deployerAddress = runSilent(`stellar keys address ${DEPLOYER_ACCOUNT}`);
  console.log(`  Address: ${deployerAddress}`);

  // 2. Build the contract
  console.log("\n🔨 Step 2: Build the contract");
  run(
    `cd ${ROOT}/contracts/crowdfunding && stellar contract build`,
  );
  console.log("✓ Contract built");

  // 3. Optimize the WASM
  console.log("\n⚡ Step 3: Optimize WASM");
  const wasmPath = `${ROOT}/contracts/crowdfunding/target/wasm32v1-none/release/nexa_crowdfunding.wasm`;

  // 4. Upload the WASM to network
  console.log("\n📤 Step 4: Upload WASM to network");
  const wasmHash = runSilent(
    `stellar contract upload \
      --wasm ${wasmPath} \
      --source ${DEPLOYER_ACCOUNT} \
      --network ${NETWORK} \
      --rpc-url "${NET.rpcUrl}" \
      --network-passphrase "${NET.passphrase}"`,
  );
  console.log(`✓ WASM uploaded. Hash: ${wasmHash}`);

  // 5. Deploy the contract
  console.log("\n🏗️  Step 5: Deploy contract instance");
  const contractId = runSilent(
    `stellar contract deploy \
      --wasm-hash ${wasmHash} \
      --source ${DEPLOYER_ACCOUNT} \
      --network ${NETWORK} \
      --rpc-url "${NET.rpcUrl}" \
      --network-passphrase "${NET.passphrase}" \
      --alias nexa-crowdfunding`,
  );
  console.log(`✓ Contract deployed. ID: ${contractId}`);

  // 6. Initialize the contract
  console.log("\n⚙️  Step 6: Initialize contract");
  const initTx = runSilent(
    `stellar contract invoke \
      --id ${contractId} \
      --source ${DEPLOYER_ACCOUNT} \
      --network ${NETWORK} \
      --rpc-url "${NET.rpcUrl}" \
      --network-passphrase "${NET.passphrase}" \
      -- initialize \
      --admin ${deployerAddress}`,
  );
  console.log(`✓ Contract initialized`);

  // 7. Generate TypeScript bindings
  console.log("\n🔗 Step 7: Generate TypeScript bindings");
  run(
    `stellar contract bindings typescript \
      --contract-id ${contractId} \
      --network ${NETWORK} \
      --rpc-url "${NET.rpcUrl}" \
      --network-passphrase "${NET.passphrase}" \
      --output-dir ${ROOT}/packages/nexa-crowdfunding \
      --overwrite`,
  );
  run(`cd ${ROOT}/packages/nexa-crowdfunding && npm install && npm run build`);
  console.log("✓ TypeScript bindings generated");

  // 8. Update config file
  console.log("\n💾 Step 8: Saving deployment config");
  const configPath = `${ROOT}/lib/contract-config.ts`;
  const config = {
    contractId,
    wasmHash,
    network: NETWORK,
    rpcUrl: NET.rpcUrl,
    networkPassphrase: NET.passphrase,
    explorerBase: NET.explorerBase,
    deployedAt: new Date().toISOString(),
    deployerAddress,
  };

  writeFileSync(
    configPath,
    `// Auto-generated by deploy.mjs — DO NOT EDIT MANUALLY
// Deployed at: ${config.deployedAt}

export const CONTRACT_CONFIG = {
  contractId: "${contractId}",
  wasmHash: "${wasmHash}",
  network: "${NETWORK}" as const,
  rpcUrl: "${NET.rpcUrl}",
  networkPassphrase: "${NET.passphrase}",
  explorerBase: "${NET.explorerBase}",
  deployedAt: "${config.deployedAt}",
  deployerAddress: "${deployerAddress}",
} as const;

export type Network = "testnet" | "mainnet";
`,
  );

  // Also update .env.local
  const envPath = `${ROOT}/.env.local`;
  let envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  const envVars = {
    NEXT_PUBLIC_CONTRACT_ID: contractId,
    NEXT_PUBLIC_NETWORK: NETWORK,
    NEXT_PUBLIC_RPC_URL: NET.rpcUrl,
    NEXT_PUBLIC_NETWORK_PASSPHRASE: NET.passphrase,
    NEXT_PUBLIC_EXPLORER_BASE: NET.explorerBase,
  };

  for (const [key, val] of Object.entries(envVars)) {
    const regex = new RegExp(`^${key}=.*`, "m");
    const line = `${key}="${val}"`;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, line);
    } else {
      envContent += `\n${line}`;
    }
  }

  writeFileSync(envPath, envContent.trim() + "\n");

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Deployment Complete!\n");
  console.log(`  Network:      ${NETWORK}`);
  console.log(`  Contract ID:  ${contractId}`);
  console.log(`  WASM Hash:    ${wasmHash}`);
  console.log(`  Explorer:     ${NET.explorerBase}/contract/${contractId}`);
  console.log(`  Deployer:     ${deployerAddress}`);
  console.log("\n  Config saved to: lib/contract-config.ts");
  console.log("  Env vars saved to: .env.local");
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});
