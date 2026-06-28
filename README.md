# 🌟 Nexa Stellar — Decentralized Crowdfunding DApp

> **Live Demo**: [https://nexa-stellar-jug5.vercel.app](https://nexa-stellar-jug5.vercel.app)
> **Contract Address**: `CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2`
> **Network**: Stellar Testnet
> **Explorer**: [View Contract](https://stellar.expert/explorer/testnet/contract/CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2)

A production-ready, full-stack decentralized crowdfunding platform built on the **Stellar blockchain** using **Soroban smart contracts**. Send XLM, launch campaigns, contribute to projects — all on-chain with full transparency.

Satisfies ✅ **White Belt** and ✅ **Orange Belt** of the [Stellar Journey to Mastery](https://www.risein.com/programs/stellar-journey-to-mastery-monthly-builder-challenges).

---

## 📸 Screenshots

| Wallet Connect | Balance Display |
|---|---|
| ![Wallet Connect](docs/screenshots/wallet-connected.png) | ![Balance](docs/screenshots/balance.png) |

| Send XLM | Transaction Success |
|---|---|
| ![Send XLM](docs/screenshots/send-xlm.png) | ![TX Success](docs/screenshots/tx-success.png) |

| Campaign List | Contract Interaction |
|---|---|
| ![Campaigns](docs/screenshots/campaigns.png) | ![Contract](docs/screenshots/contract.png) |

---

## ✨ Features

### ⚪ White Belt
- 🔐 **Freighter Wallet** — connect, disconnect, display address & balance
- 💰 **Live XLM Balance** — fetched in real-time from Horizon API
- 💸 **Send XLM** — native payment to any Stellar address with:
  - ⏳ Loading states (building → signing → submitting)
  - ✅ Success state with transaction hash + explorer link
  - ❌ Failure state with user-friendly error messages
  - 📝 Optional memo support
- 📋 **Transaction History** — persistent with pending/success/failed badges
- 📱 **Responsive UI** — mobile-first dark design

### 🟠 Orange Belt
- 🪪 **Multi-wallet via StellarWalletsKit** — Freighter, LOBSTR, xBull, Albedo, Rabet
  - Wallet not installed → clear install message
  - User rejected → friendly rejection message
  - Insufficient balance → specific error
- 📦 **Soroban Smart Contract** — Crowdfunding contract on Testnet
  - ✅ Read contract state (campaigns, counts, contributions)
  - ✅ Write to contract (create, contribute, claim, cancel)
  - ✅ Transaction status: Pending → Success / Failed
- 📡 **Real-time Updates** — contract event polling every 15s
- 🔗 **Explorer Integration** — deep links to stellar.expert

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Server State | TanStack Query v5 |
| Client State | Zustand |
| Multi-wallet | @creit.tech/stellar-wallets-kit |
| Blockchain SDK | @stellar/stellar-sdk v13 |
| Smart Contract | Rust + soroban-sdk v22 |
| Network | Stellar Testnet |
| Deployment | Vercel |

---

## 📁 Folder Structure

```
nexa-stellar/
├── app/
│   ├── page.tsx                 # Home — hero, stats, campaigns
│   ├── send/page.tsx            # ⭐ Send XLM (White Belt)
│   ├── campaigns/
│   │   ├── page.tsx             # All campaigns
│   │   └── [id]/page.tsx        # Campaign detail
│   ├── dashboard/page.tsx       # Wallet dashboard
│   ├── activity/page.tsx        # Real-time events
│   ├── tx/page.tsx              # Transaction history
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles
│
├── components/
│   ├── wallet/
│   │   ├── WalletButton.tsx     # Connect/disconnect
│   │   └── SendXLMModal.tsx     # Send XLM (all states)
│   ├── campaign/
│   │   ├── CampaignCard.tsx     # Campaign card + skeleton
│   │   ├── CreateCampaignModal.tsx
│   │   └── ContributeModal.tsx
│   └── shared/
│       ├── Header.tsx
│       ├── Toaster.tsx
│       └── TransactionHistory.tsx
│
├── hooks/
│   ├── use-wallet.ts            # StellarWalletsKit
│   ├── use-send.ts              # XLM payment state machine
│   ├── use-campaigns.ts         # TanStack Query hooks
│   ├── use-events.ts            # Event polling
│   └── use-toast.ts
│
├── lib/
│   ├── payment-client.ts        # Native XLM via Horizon
│   ├── soroban-client.ts        # Soroban RPC + tx builders
│   ├── contract-config.ts       # Network config
│   ├── wallet-store.ts          # Zustand wallet state
│   ├── tx-store.ts              # Zustand tx history
│   └── stellar-utils.ts        # Utilities
│
├── contracts/
│   └── crowdfunding/
│       ├── src/lib.rs           # Soroban contract
│       └── Cargo.toml
│
├── scripts/
│   └── deploy.mjs               # Deployment script
│
├── types/
│   └── index.ts
│
└── .env.example
```

---

## 🚀 Setup Instructions

### Prerequisites

```bash
# Node.js 18+
node -v

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Stellar CLI
brew install stellar-cli
# OR
cargo install --locked stellar-cli --features opt

# Freighter wallet extension
# https://freighter.app
```

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/nexa-stellar.git
cd nexa-stellar
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_NETWORK="testnet"
NEXT_PUBLIC_CONTRACT_ID="CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2"
NEXT_PUBLIC_RPC_URL="https://soroban-testnet.stellar.org"
NEXT_PUBLIC_HORIZON_URL="https://horizon-testnet.stellar.org"
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_EXPLORER_BASE="https://stellar.expert/explorer/testnet"
```

### 3. Run Locally

```bash
npm run dev
# → http://localhost:3000
```

### 4. Get Free Test XLM

```
https://friendbot.stellar.org?addr=YOUR_WALLET_ADDRESS
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed Soroban contract ID |
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon REST API |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase |
| `NEXT_PUBLIC_EXPLORER_BASE` | stellar.expert base URL |

---

## 📦 Smart Contract

**Language**: Rust (soroban-sdk v22)
**Network**: Stellar Testnet
**Contract ID**: `CAHQCXE7OTEJU4UFL3H325RSJVC3RBPUJR4C6CRJHPSQSHAWXWF43JP2`

### Deploy Your Own

```bash
# Build
npm run contract:build

# Deploy to Testnet
npm run deploy:testnet
```

### Contract Functions

| Function | Description |
|---|---|
| `initialize(admin)` | One-time setup |
| `create_campaign(creator, title, desc, goal, duration)` | Launch campaign |
| `contribute(id, contributor, amount)` | Fund with XLM |
| `claim_funds(id, creator)` | Claim after goal reached |
| `cancel_campaign(id, creator)` | Cancel if no contributions |
| `get_campaign(id)` | Read campaign state |
| `get_campaign_count()` | Total campaigns |
| `get_contribution(id, addr)` | Contributor amount |

### Contract Events

| Event | Trigger |
|---|---|
| `CAMP_NEW` | Campaign created |
| `CAMP_FUND` | Contribution made |
| `CAMP_CLAM` | Funds claimed |
| `CAMP_CAN` | Campaign cancelled |

---

## 🌐 Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variables
vercel env add NEXT_PUBLIC_CONTRACT_ID

# Production deploy
vercel --prod
```

Or connect GitHub repo to Vercel and add env vars in Dashboard → Settings → Environment Variables.

---

## 🔮 Future Improvements

- [ ] Multi-asset contributions (USDC, AQUA)
- [ ] NFT rewards for backers
- [ ] Campaign milestone releases
- [ ] On-chain governance voting
- [ ] Mobile app (React Native)
- [ ] Mainnet deployment
- [ ] SEP-24 fiat off-ramp for creators
- [ ] Email notifications via Stellar Anchor
- [ ] DAO governance for platform fees
- [ ] Smart contract security audit

---

## ✅ White Belt & Orange Belt Checklist

| Requirement | Status |
|---|---|
| ✅ Freighter Wallet Setup | Done |
| ✅ Stellar Testnet | Done |
| ✅ Wallet Connect | Done |
| ✅ Wallet Disconnect | Done |
| ✅ Fetch XLM Balance | Done |
| ✅ Display Balance | Done |
| ✅ Send XLM on Testnet | Done |
| ✅ Loading State | Done |
| ✅ Success State + TX Hash | Done |
| ✅ Failure State + Error Message | Done |
| ✅ Good Error Messages | Done |
| ✅ Clean Folder Structure | Done |
| ✅ Reusable Components | Done |
| ✅ Responsive UI | Done |
| ✅ Multi-wallet (StellarWalletsKit) | Done |
| ✅ Wallet Not Installed Error | Done |
| ✅ User Rejected Error | Done |
| ✅ Insufficient Balance Error | Done |
| ✅ Soroban Smart Contract Deployed | Done |
| ✅ Read Contract State | Done |
| ✅ Write Contract State | Done |
| ✅ TX Status Pending / Success / Failed | Done |
| ✅ Real-time Event Polling | Done |
| ✅ Auto UI Update | Done |
| ✅ 2+ Meaningful Git Commits | Done |
| ✅ Public GitHub Repository | Done |
| ✅ README Complete | Done |
| ✅ Live Demo | Done |

---

## 👨‍💻 Built With ❤️ on Stellar

> Nexa Stellar is part of the Stellar Journey to Mastery builder program by [Rise In](https://www.risein.com).