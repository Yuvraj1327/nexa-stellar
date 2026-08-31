#!/usr/bin/env node
/**
 * Nexa Milestone Contract Deployment Script (Level 3/4)
 * Usage: node scripts/deploy-milestone.mjs [--network testnet|mainnet]
 */
import "dotenv/config";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NETWORK = process.argv.includes("--network")
  ? process.argv[process.argv.indexOf("--network") + 1]
  : "testnet";

const NETS = {
  testnet: { rpc: "https://soroban-testnet.stellar.org", passphrase: "Test SDF Network ; September 2015", explorer: "https://stellar.expert/explorer/testnet" },
  mainnet: { rpc: "https://mainnet.sorobanrpc.com", passphrase: "Public Global Stellar Network ; September 2015", explorer: "https://stellar.expert/explorer/public" },
};

const NET = NETS[NETWORK];
const DEPLOYER = process.env.DEPLOYER_ACCOUNT || "nexa-deployer";
const q = cmd => execSync(cmd, { stdio: "pipe" }).toString().trim();
const r = cmd => { console.log(`\n$ ${cmd}`); execSync(cmd, { stdio: "inherit" }); };

async function main() {
  console.log(`\n🚀 Deploying Nexa Milestone Contract to ${NETWORK.toUpperCase()}\n${"=".repeat(60)}`);

  // Identity
  let addr;
  try { addr = q(`stellar keys address ${DEPLOYER}`); console.log(`✓ Identity: ${DEPLOYER} (${addr})`); }
  catch { r(`stellar keys generate --fund ${DEPLOYER} --network ${NETWORK}`); addr = q(`stellar keys address ${DEPLOYER}`); }

  // Build
  console.log("\n🔨 Building contract...");
  r(`cd ${ROOT}/contracts/milestone && stellar contract build`);

  // Test
  console.log("\n🧪 Running tests...");
  r(`cd ${ROOT}/contracts/milestone && cargo test --features testutils`);

  // Upload
  console.log("\n📤 Uploading WASM...");
  const wasm = `${ROOT}/contracts/milestone/target/wasm32v1-none/release/nexa_milestone.wasm`;
  const hash = q(`stellar contract upload --wasm ${wasm} --source ${DEPLOYER} --network ${NETWORK} --rpc-url "${NET.rpc}" --network-passphrase "${NET.passphrase}"`);
  console.log(`✓ Hash: ${hash}`);

  // Deploy
  console.log("\n🏗️  Deploying...");
  const contractId = q(`stellar contract deploy --wasm-hash ${hash} --source ${DEPLOYER} --network ${NETWORK} --rpc-url "${NET.rpc}" --network-passphrase "${NET.passphrase}" --alias nexa-milestone`);
  console.log(`✓ Contract ID: ${contractId}`);

  // Initialize
  console.log("\n⚙️  Initializing...");
  q(`stellar contract invoke --id ${contractId} --source ${DEPLOYER} --network ${NETWORK} --rpc-url "${NET.rpc}" --network-passphrase "${NET.passphrase}" -- initialize --admin ${addr}`);
  console.log("✓ Initialized");

  // Update .env.local
  const envPath = `${ROOT}/.env.local`;
  let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const set = (k, v) => { const rx = new RegExp(`^${k}=.*`, "m"); const line = `${k}="${v}"`; env = rx.test(env) ? env.replace(rx, line) : env + `\n${line}`; };
  set("NEXT_PUBLIC_MILESTONE_CONTRACT_ID", contractId);
  writeFileSync(envPath, env.trim() + "\n");

  console.log(`\n${"=".repeat(60)}\n🎉 Deployed!\n\n  Contract: ${contractId}\n  Explorer: ${NET.explorer}/contract/${contractId}\n\n  Add to Vercel:\n  NEXT_PUBLIC_MILESTONE_CONTRACT_ID=${contractId}\n${"=".repeat(60)}\n`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
