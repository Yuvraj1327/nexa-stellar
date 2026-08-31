#!/usr/bin/env node
/**
 * Nexa Milestone Contract — Deployment Script
 *
 * Deploys contracts/milestone/ to Stellar Testnet (or Mainnet).
 *
 * Usage:
 *   node scripts/deploy-milestone.mjs [--network testnet|mainnet] [--skip-tests]
 *
 * Requires:
 *   - Rust + cargo  (https://rustup.rs)
 *   - stellar CLI   (brew install stellar-cli  OR  cargo install stellar-cli)
 *
 * Never touches private keys — uses stellar CLI identity (stored in ~/.config/stellar/).
 */

import { execSync, execFileSync } from "child_process";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Config ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const CONTRACT  = path.join(ROOT, "contracts", "milestone");

const NETWORK = (() => {
  const i = process.argv.indexOf("--network");
  return i !== -1 ? process.argv[i + 1] : "testnet";
})();

const SKIP_TESTS = process.argv.includes("--skip-tests");

const NETS = {
  testnet: {
    rpc:        "https://soroban-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    explorer:   "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    rpc:        "https://mainnet.sorobanrpc.com",
    passphrase: "Public Global Stellar Network ; September 2015",
    explorer:   "https://stellar.expert/explorer/public",
  },
};

if (!NETS[NETWORK]) {
  console.error(`Unknown network: ${NETWORK}. Use testnet or mainnet.`);
  process.exit(1);
}

const NET      = NETS[NETWORK];
const DEPLOYER = process.env.DEPLOYER_ACCOUNT || "nexa-deployer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Run a command, capture stdout, throw on non-zero exit. */
function capture(cmd) {
  return execSync(cmd, { stdio: ["inherit", "pipe", "pipe"] })
    .toString()
    .trim();
}

/** Run a command, inherit all stdio (visible output). */
function run(cmd) {
  console.log(`\n$ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit" });
}

/** Run a command, show stderr on failure, return trimmed stdout. */
function captureSafe(cmd) {
  try {
    return capture(cmd);
  } catch (err) {
    const stderr = err.stderr?.toString() ?? "";
    if (stderr) process.stderr.write(stderr + "\n");
    throw new Error(err.stdout?.toString().trim() || err.message);
  }
}

/**
 * Parse the last meaningful line from stellar CLI output.
 * stellar CLI often prints progress lines (ℹ️, ✅, 🔗) before the actual value.
 */
function lastLine(output) {
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("ℹ") && !l.startsWith("✅") && !l.startsWith("🔗") && !l.startsWith("⚠"))
    .pop() ?? "";
}

/** Update or add a key=value line in .env.local (never touches other keys). */
function setEnvVar(envPath, key, value) {
  let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line  = `${key}="${value}"`;
  const rx    = new RegExp(`^${key}=.*`, "m");
  content     = rx.test(content) ? content.replace(rx, line) : content + `\n${line}`;
  writeFileSync(envPath, content.trim() + "\n");
}

/** Find the built WASM file — handles both target names stellar CLI uses. */
function findWasm() {
  const candidates = [
    path.join(CONTRACT, "target", "wasm32v1-none", "release", "nexa_milestone.wasm"),
    path.join(CONTRACT, "target", "wasm32-unknown-unknown", "release", "nexa_milestone.wasm"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Also try to find any .wasm in release dirs
  for (const dir of [
    path.join(CONTRACT, "target", "wasm32v1-none", "release"),
    path.join(CONTRACT, "target", "wasm32-unknown-unknown", "release"),
  ]) {
    if (existsSync(dir)) {
      const found = readdirSync(dir).find((f) => f.endsWith(".wasm") && !f.includes("deps"));
      if (found) return path.join(dir, found);
    }
  }
  throw new Error(
    "Built WASM not found. Make sure the contract compiled successfully."
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🚀  Nexa Milestone Contract — Deploy to ${NETWORK.toUpperCase()}`);
  console.log(`${"═".repeat(60)}\n`);

  // ── 1. Verify stellar CLI ─────────────────────────────────────────────────
  console.log("🔍  Step 1: Checking stellar CLI...");
  try {
    const ver = capture("stellar --version");
    console.log(`    ✓ ${ver.split("\n")[0]}`);
  } catch {
    console.error("    ✗ stellar CLI not found. Install with: brew install stellar-cli");
    process.exit(1);
  }

  // ── 2. Identity ───────────────────────────────────────────────────────────
  console.log(`\n🔑  Step 2: Deployer identity (${DEPLOYER})...`);
  let deployerAddress;
  try {
    deployerAddress = capture(`stellar keys address ${DEPLOYER}`);
    console.log(`    ✓ Address: ${deployerAddress}`);
  } catch {
    console.log(`    ✦ Creating new identity: ${DEPLOYER}`);
    run(`stellar keys generate --fund ${DEPLOYER} --network ${NETWORK}`);
    deployerAddress = capture(`stellar keys address ${DEPLOYER}`);
    console.log(`    ✓ Address: ${deployerAddress}`);
  }

  // Ensure account exists on-chain (fund via Friendbot if testnet)
  if (NETWORK === "testnet") {
    try {
      captureSafe(
        `stellar keys fund ${DEPLOYER} --network ${NETWORK}`
      );
      console.log("    ✓ Account funded via Friendbot");
    } catch {
      // Already funded — that's fine
      console.log("    ✓ Account already exists on Testnet");
    }
  }

  // ── 3. Build contract ─────────────────────────────────────────────────────
  console.log("\n🔨  Step 3: Building contract...");
  run(`cd "${CONTRACT}" && stellar contract build`);
  console.log("    ✓ Build complete");

  // ── 4. Run tests (optional skip) ──────────────────────────────────────────
  if (SKIP_TESTS) {
    console.log("\n🧪  Step 4: Tests skipped (--skip-tests)");
  } else {
    console.log("\n🧪  Step 4: Running contract tests...");
    run(`cd "${CONTRACT}" && cargo test --features testutils`);
    console.log("    ✓ All tests passed");
  }

  // ── 5. Locate WASM ────────────────────────────────────────────────────────
  const wasmPath = findWasm();
  console.log(`\n📦  WASM: ${path.relative(ROOT, wasmPath)}`);

  // ── 6. Upload WASM ────────────────────────────────────────────────────────
  console.log("\n📤  Step 5: Uploading WASM to network...");
  const uploadOut = captureSafe(
    `stellar contract upload \
      --wasm "${wasmPath}" \
      --source ${DEPLOYER} \
      --network ${NETWORK} \
      --rpc-url "${NET.rpc}" \
      --network-passphrase "${NET.passphrase}"`
  );
  const wasmHash = lastLine(uploadOut);

  if (!wasmHash || wasmHash.length < 60) {
    console.error("    ✗ Could not parse WASM hash from output:");
    console.error(uploadOut);
    process.exit(1);
  }
  console.log(`    ✓ WASM hash: ${wasmHash}`);

  // ── 7. Deploy contract instance ───────────────────────────────────────────
  console.log("\n🏗️   Step 6: Deploying contract instance...");
  const deployOut = captureSafe(
    `stellar contract deploy \
      --wasm-hash ${wasmHash} \
      --source ${DEPLOYER} \
      --network ${NETWORK} \
      --rpc-url "${NET.rpc}" \
      --network-passphrase "${NET.passphrase}"`
  );
  const contractId = lastLine(deployOut);

  if (!contractId || contractId.length < 50 || contractId.includes(" ")) {
    console.error("    ✗ Could not parse Contract ID from output:");
    console.error(deployOut);
    process.exit(1);
  }
  console.log(`    ✓ Contract ID: ${contractId}`);

  // ── 8. Initialize contract ────────────────────────────────────────────────
  console.log("\n⚙️   Step 7: Initializing contract...");
  try {
    const initOut = captureSafe(
      `stellar contract invoke \
        --id ${contractId} \
        --source ${DEPLOYER} \
        --network ${NETWORK} \
        --rpc-url "${NET.rpc}" \
        --network-passphrase "${NET.passphrase}" \
        -- initialize \
        --admin ${deployerAddress}`
    );
    console.log("    ✓ Contract initialized");
    if (initOut) console.log(`    ${initOut}`);
  } catch (err) {
    // "Already initialized" is fine if re-running the script
    if (err.message.includes("Already initialized")) {
      console.log("    ✓ Contract already initialized (re-deploy)");
    } else {
      throw err;
    }
  }

  // ── 9. Save to .env.local ─────────────────────────────────────────────────
  console.log("\n💾  Step 8: Saving to .env.local...");
  const envPath = path.join(ROOT, ".env.local");
  setEnvVar(envPath, "NEXT_PUBLIC_MILESTONE_CONTRACT_ID", contractId);
  setEnvVar(envPath, "NEXT_PUBLIC_NETWORK", NETWORK);
  console.log(`    ✓ NEXT_PUBLIC_MILESTONE_CONTRACT_ID saved`);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log("🎉  Deployment complete!\n");
  console.log(`    Contract ID : ${contractId}`);
  console.log(`    Network     : ${NETWORK}`);
  console.log(`    Explorer    : ${NET.explorer}/contract/${contractId}`);
  console.log(`\n    Next steps:`);
  console.log(`    1. Add to Vercel env vars:`);
  console.log(`       NEXT_PUBLIC_MILESTONE_CONTRACT_ID=${contractId}`);
  console.log(`    2. Redeploy on Vercel (auto if GitHub-connected)`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("\n❌  Deployment failed:", err.message);
  process.exit(1);
});
