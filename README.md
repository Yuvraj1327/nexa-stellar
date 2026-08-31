# Nexa Stellar — Milestone-Based Decentralized Crowdfunding

**Live Demo**: https://nexa-stellar-jug5.vercel.app

**Network**: Stellar Testnet

---

## Deployed Contracts

| Contract | Address |
|---|---|
| Crowdfunding (Level 1/2) | `CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2` |
| Milestone Escrow (Level 3/4) | `CAVKC6G5XI52W3AWUM3MYA7TXDSNXJVZPDZSHOLVFCL7QED3BAFBZW42` |

**Deployment TX**: `2ac0cad463c507587826f06e8d7e8494268865f824fea859b3f513a01de8a677`

**Milestone Contract Explorer**: https://stellar.expert/explorer/testnet/contract/CAVKC6G5XI52W3AWUM3MYA7TXDSNXJVZPDZSHOLVFCL7QED3BAFBZW42

---

## What is Nexa Stellar?

Nexa is a decentralized crowdfunding platform on the Stellar blockchain. Backers fund campaigns with XLM, funds are locked in a Soroban smart contract escrow, creators submit milestone proof, backers vote on-chain, and funds are released automatically when approved.

No intermediaries. No trust required. Everything is verifiable on Stellar Testnet.

---

## Problem

Traditional crowdfunding has two core problems:

1. Creators receive all funds upfront with no accountability to deliver.
2. Backers have no recourse if a creator disappears or fails to deliver.

## Solution

Nexa solves this with milestone-based escrow on Stellar:

- Funds are locked in a Soroban smart contract when backers contribute.
- Creators submit proof of work for each milestone.
- Backers vote on whether to approve the milestone.
- Funds are only released from escrow when a milestone is approved by vote.
- If a campaign fails or is cancelled, backers can claim a refund.

---

## Features

### Level 1 + 2 (White Belt + Orange Belt)

- Connect and disconnect Stellar wallets (Freighter, LOBSTR, xBull, Albedo)
- Live XLM balance fetched from Horizon API
- Send XLM to any Stellar address on Testnet
- Loading, success, and failed transaction states with TX hash
- Multi-wallet support via StellarWalletsKit
- Wallet not installed, user rejected, insufficient balance error handling
- Basic crowdfunding contract: create campaign, contribute, claim, cancel
- Transaction history with pending / success / failed status

### Level 3 + 4 (Yellow Belt + Green Belt)

- Soroban escrow: XLM locked until milestone approved
- Milestone management: creators define deliverables with XLM amounts
- On-chain voting: backers vote yes/no per milestone
- Quorum system: 50% participation + 60% approval required
- Auto-release: approved milestones unlock escrow funds
- Refund logic: pro-rata refund on campaign failure or cancellation
- Analytics dashboard with real on-chain metrics
- User feedback system
- Real-time contract event polling (10–15s intervals)
- GitHub Actions CI/CD pipeline
- 14-test contract suite
- Mobile-responsive UI with hamburger navigation

---

## Milestone Flow

```
Creator creates campaign
  → adds milestones with XLM amounts
  → backers contribute XLM (locked in escrow)
  → creator marks campaign as started
  → creator submits proof URL for milestone
  → voting opens (7 days)
  → backers vote yes or no
  → 60% yes + 50% quorum = approved
  → creator releases funds from escrow
  → if rejected or campaign fails → backers claim refund
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5.24 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Server State | TanStack Query v5 |
| Client State | Zustand v4 |
| Multi-wallet | @creit.tech/stellar-wallets-kit v0.9.2 |
| Blockchain SDK | @stellar/stellar-sdk v13 |
| Smart Contracts | Rust + soroban-sdk v22 |
| Network | Stellar Testnet |
| Deployment | Vercel |
| CI/CD | GitHub Actions |

---

## Smart Contracts

### Milestone Escrow Contract (Level 3/4)

**Contract ID**: `CAVKC6G5XI52W3AWUM3MYA7TXDSNXJVZPDZSHOLVFCL7QED3BAFBZW42`

| Function | Description |
|---|---|
| `initialize(admin)` | One-time contract setup |
| `create_campaign(creator, title, desc, goal, duration)` | Launch a campaign |
| `add_milestone(campaign_id, creator, title, desc, amount)` | Add a deliverable |
| `contribute(campaign_id, contributor, amount)` | Fund — goes to escrow |
| `start_campaign(campaign_id, creator)` | Activate after fully funded |
| `submit_milestone(campaign_id, milestone_id, creator, proof_url)` | Submit proof |
| `vote_milestone(campaign_id, milestone_id, voter, approve)` | Backer votes |
| `finalize_milestone(campaign_id, milestone_id)` | Resolve after voting ends |
| `release_milestone(campaign_id, milestone_id, creator)` | Release escrow funds |
| `claim_refund(campaign_id, backer)` | Refund on failure |
| `cancel_campaign(campaign_id, creator)` | Cancel and enable refunds |

**Events emitted**: `CAMPCRTD`, `CONTRIB`, `MSSUB`, `VOTECAST`, `MSAPRVD`, `MSRJCTD`, `FUNDSREL`, `REFUND`, `CAMPDONE`, `CANCELD`

**Voting rules**:
- Quorum: 50% of backers must vote
- Approval: 60% of votes must be YES
- Window: 7 days after proof submission
- Double-vote prevention enforced on-chain

### Crowdfunding Contract (Level 1/2)

**Contract ID**: `CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2`

Basic campaign create, contribute, claim, and cancel without milestone logic.

---

## Folder Structure

```
nexa-stellar/
├── app/
│   ├── page.tsx                 # Home
│   ├── send/page.tsx            # Send XLM
│   ├── campaigns/
│   │   ├── page.tsx             # Campaign list
│   │   └── [id]/page.tsx        # Campaign detail + contribute
│   ├── milestones/page.tsx      # Milestone explorer + voting
│   ├── dashboard/page.tsx       # Wallet dashboard
│   ├── analytics/page.tsx       # Platform analytics
│   ├── activity/page.tsx        # Real-time events
│   ├── tx/page.tsx              # Transaction history
│   └── feedback/page.tsx        # User feedback
├── components/
│   ├── wallet/
│   │   ├── WalletButton.tsx
│   │   └── SendXLMModal.tsx
│   ├── campaign/
│   │   ├── CampaignCard.tsx
│   │   ├── CreateCampaignModal.tsx
│   │   └── ContributeModal.tsx
│   ├── milestone/
│   │   └── MilestonePanel.tsx
│   └── shared/
│       ├── Header.tsx
│       ├── Toaster.tsx
│       └── TransactionHistory.tsx
├── hooks/
│   ├── use-wallet.ts
│   ├── use-send.ts
│   ├── use-campaigns.ts
│   ├── use-milestones.ts
│   ├── use-events.ts
│   └── use-toast.ts
├── lib/
│   ├── soroban-client.ts        # Level 1/2 contract client
│   ├── milestone-client.ts      # Level 3/4 contract client
│   ├── payment-client.ts        # Horizon XLM payments
│   ├── contract-config.ts       # Network config
│   ├── wallet-store.ts
│   ├── tx-store.ts
│   └── stellar-utils.ts
├── contracts/
│   ├── crowdfunding/            # Level 1/2 contract
│   └── milestone/               # Level 3/4 escrow contract
├── scripts/
│   ├── deploy.mjs               # Deploy crowdfunding contract
│   └── deploy-milestone.mjs     # Deploy milestone contract
├── types/
│   └── index.ts
└── .github/
    └── workflows/ci.yml
```

---

## Setup Instructions

### Prerequisites

```bash
# Node.js 20+
node -v

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Stellar CLI
brew install stellar-cli

# Freighter wallet browser extension
# https://freighter.app
```

### 1. Clone and install

```bash
git clone https://github.com/Yuvraj1327/nexa-stellar.git
cd nexa-stellar
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_CONTRACT_ID=CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2
NEXT_PUBLIC_MILESTONE_CONTRACT_ID=CAVKC6G5XI52W3AWUM3MYA7TXDSNXJVZPDZSHOLVFCL7QED3BAFBZW42
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 4. Get free test XLM

```
https://friendbot.stellar.org?addr=YOUR_WALLET_ADDRESS
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_CONTRACT_ID` | Crowdfunding contract (Level 1/2) |
| `NEXT_PUBLIC_MILESTONE_CONTRACT_ID` | Milestone escrow contract (Level 3/4) |
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon REST API |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Stellar network passphrase |
| `NEXT_PUBLIC_EXPLORER_BASE` | stellar.expert base URL |
| `DEPLOYER_ACCOUNT` | Stellar CLI identity name (deploy only) |

---

## Deploy Contracts

### Deploy milestone contract (Level 3/4)

```bash
node scripts/deploy-milestone.mjs --network testnet
```

With tests skipped (faster):

```bash
node scripts/deploy-milestone.mjs --network testnet --skip-tests
```

### Deploy crowdfunding contract (Level 1/2)

```bash
npm run deploy:testnet
```

---

## Run Contract Tests

```bash
# Milestone contract (14 tests)
npm run contract:test:milestone

# Crowdfunding contract
npm run contract:test

# Both
npm run contract:test:all
```

---

## Vercel Deployment

Add these environment variables in Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_NETWORK = testnet
NEXT_PUBLIC_CONTRACT_ID = CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2
NEXT_PUBLIC_MILESTONE_CONTRACT_ID = CAVKC6G5XI52W3AWUM3MYA7TXDSNXJVZPDZSHOLVFCL7QED3BAFBZW42
NEXT_PUBLIC_RPC_URL = https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL = https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE = Test SDF Network ; September 2015
NEXT_PUBLIC_EXPLORER_BASE = https://stellar.expert/explorer/testnet
```

Then push to GitHub — Vercel auto-deploys.

---

## CI/CD

GitHub Actions runs on every push to `main`:

1. TypeScript type check
2. Next.js production build
3. Soroban contract tests (both contracts)
4. Deploy to Vercel

---

## Testing

### Contract tests

The milestone contract has 14 tests covering:

- Contract initialization and double-init prevention
- Campaign creation and validation
- Milestone creation and amount validation
- Contribution and escrow locking
- Minimum contribution enforcement
- Full milestone approval flow (submit → vote → finalize → release)
- Milestone rejection when votes fail
- Double-vote prevention
- Non-backer vote prevention
- Refund on expired campaign
- Double-refund prevention
- Cancel campaign and refund eligibility
- Milestone amount exceeding goal prevention
- Empty proof URL rejection

Run with:

```bash
cd contracts/milestone && cargo test --features testutils
```

---

## Wallet Support

| Wallet | Status |
|---|---|
| Freighter | Available |
| Albedo | Available |
| xBull | Available |
| LOBSTR | Not available on desktop |
| Rabet | Not available on desktop |

Install Freighter: https://freighter.app

Set Freighter to **Testnet** in Settings → Network before connecting.

---

## Future Improvements

- Multi-asset contributions (USDC, AQUA)
- NFT rewards for backers
- Milestone dispute resolution
- Mobile app (React Native)
- Mainnet deployment with audited contract
- SEP-24 fiat off-ramp for creators
- DAO governance for platform fees

---

## Submission Checklist

- [x] Public GitHub repository
- [x] README with setup instructions
- [x] 15+ meaningful git commits
- [x] Live demo — https://nexa-stellar-jug5.vercel.app
- [x] Wallet options — Freighter, Albedo, xBull, LOBSTR, Rabet
- [x] Crowdfunding contract — `CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2`
- [x] Milestone contract — `CAVKC6G5XI52W3AWUM3MYA7TXDSNXJVZPDZSHOLVFCL7QED3BAFBZW42`
- [x] Transaction hash — `2ac0cad463c507587826f06e8d7e8494268865f824fea859b3f513a01de8a677`
- [x] Soroban escrow contract with milestone + voting + refunds
- [x] 14 contract tests
- [x] GitHub Actions CI/CD
- [x] Analytics dashboard with real on-chain data
- [x] User feedback system
- [x] Mobile responsive UI
- [x] Architecture documentation