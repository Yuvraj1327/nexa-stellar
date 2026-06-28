# Nexa Stellar — Decentralized Crowdfunding DApp

**Live Demo**: https://nexa-stellar-jug5.vercel.app

**Deployed Contract Address**: `CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2`

**Transaction Hash**: `2ac0cad463c507587826f06e8d7e8494268865f824fea859b3f513a01de8a677`

**Explorer**: https://stellar.expert/explorer/testnet/contract/CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2

---

## What is Nexa Stellar?

A decentralized crowdfunding platform built on the Stellar blockchain using Soroban smart contracts. Users can launch campaigns, contribute XLM, and track everything transparently on-chain — no intermediaries.

Built for the **Stellar Journey to Mastery** (White Belt + Orange Belt).

---

## Features

- Connect and disconnect Stellar wallets (Freighter, LOBSTR, xBull, Albedo)
- Display live XLM balance from Horizon API
- Send XLM to any Stellar address on Testnet
- Loading, success, and failed transaction states
- Transaction hash displayed with Explorer link on success
- Create crowdfunding campaigns on Soroban smart contract
- Contribute XLM to campaigns
- Claim funds after campaign goal is reached
- Cancel campaigns with no contributions
- Real-time contract event polling every 15 seconds
- Transaction history with pending / success / failed status
- Wallet not installed, user rejected, insufficient balance error handling
- Responsive dark UI

---

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- TanStack Query v5
- Zustand
- @creit.tech/stellar-wallets-kit
- @stellar/stellar-sdk v13
- Soroban smart contract (Rust, soroban-sdk v22)
- Vercel (deployment)

---

## Wallet Options Available

The app supports the following wallets via StellarWalletsKit:

- Freighter
- Albedo
- xBull
- LOBSTR
- Rabet

Connect wallet modal shows all available options on the site.

---

## Setup Instructions

### Prerequisites

```bash
# Node.js 18+
node -v

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Stellar CLI
brew install stellar-cli

# Freighter browser extension
# https://freighter.app
```

### Install

```bash
git clone https://github.com/yourusername/nexa-stellar.git
cd nexa-stellar
npm install
```

### Environment Variables

Create `.env.local` file:

```
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_CONTRACT_ID=CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
```

### Run Locally

```bash
npm run dev
```

Open http://localhost:3000

### Get Free Test XLM

```
https://friendbot.stellar.org?addr=YOUR_WALLET_ADDRESS
```

---

## Folder Structure

```
nexa-stellar/
├── app/
│   ├── page.tsx                 # Home page
│   ├── send/page.tsx            # Send XLM
│   ├── campaigns/page.tsx       # All campaigns
│   ├── campaigns/[id]/page.tsx  # Campaign detail
│   ├── dashboard/page.tsx       # Wallet dashboard
│   ├── activity/page.tsx        # Real-time events
│   └── tx/page.tsx              # Transaction history
├── components/
│   ├── wallet/
│   │   ├── WalletButton.tsx
│   │   └── SendXLMModal.tsx
│   ├── campaign/
│   │   ├── CampaignCard.tsx
│   │   ├── CreateCampaignModal.tsx
│   │   └── ContributeModal.tsx
│   └── shared/
│       ├── Header.tsx
│       ├── Toaster.tsx
│       └── TransactionHistory.tsx
├── hooks/
│   ├── use-wallet.ts
│   ├── use-send.ts
│   ├── use-campaigns.ts
│   ├── use-events.ts
│   └── use-toast.ts
├── lib/
│   ├── payment-client.ts
│   ├── soroban-client.ts
│   ├── contract-config.ts
│   ├── wallet-store.ts
│   ├── tx-store.ts
│   └── stellar-utils.ts
├── contracts/
│   └── crowdfunding/
│       ├── src/lib.rs
│       └── Cargo.toml
├── scripts/
│   └── deploy.mjs
└── types/
    └── index.ts
```

---

## Smart Contract

**Contract ID**: `CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2`

**Deploy your own**:

```bash
npm run deploy:testnet
```

**Functions**:

| Function | Description |
|---|---|
| `initialize(admin)` | One-time setup |
| `create_campaign(...)` | Launch a campaign |
| `contribute(id, addr, amount)` | Fund with XLM |
| `claim_funds(id, creator)` | Claim after goal reached |
| `cancel_campaign(id, creator)` | Cancel campaign |
| `get_campaign(id)` | Read campaign state |
| `get_campaign_count()` | Total campaigns |
| `get_contribution(id, addr)` | Contributor amount |

---

## Future Improvements

- Multi-asset contributions (USDC, AQUA)
- NFT rewards for backers
- Milestone-based fund releases
- Mobile app
- Mainnet deployment

---

## Submission Checklist

- [x] Public GitHub repository
- [x] README with setup instructions
- [x] Minimum 2+ meaningful commits (5 commits)
- [x] Live demo link — https://nexa-stellar-jug5.vercel.app
- [x] Screenshot: wallet options available (Freighter, Albedo, xBull, LOBSTR, Rabet)
- [x] Deployed contract address — `CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2`
- [x] Transaction hash — `2ac0cad463c507587826f06e8d7e8494268865f824fea859b3f513a01de8a677`