# Nexa Stellar — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 15 Frontend                │
│                                                     │
│  Pages: / /campaigns /milestones /send /dashboard   │
│         /analytics /activity /tx /feedback          │
│                                                     │
│  State: TanStack Query (server) + Zustand (client)  │
│  Wallet: StellarWalletsKit (multi-wallet)           │
└────────────────┬───────────────────┬────────────────┘
                 │                   │
         Soroban RPC           Horizon API
                 │                   │
┌────────────────▼───────┐   ┌──────▼────────────────┐
│   FlowLance Contract   │   │   Stellar Network      │
│   (Level 3/4)          │   │                        │
│                        │   │  - XLM balances        │
│  - Campaign escrow     │   │  - Payment TX          │
│  - Milestone tracking  │   │  - Account info        │
│  - Backer voting       │   └───────────────────────┘
│  - Fund release        │
│  - Refund logic        │
└────────────────────────┘
┌────────────────────────┐
│  Crowdfunding Contract │
│  (Level 1/2)           │
│                        │
│  - Basic campaigns     │
│  - Contributions       │
│  - Claim/cancel        │
└────────────────────────┘
```

## FlowLance Milestone Flow

```
Creator                    Contract                    Backers
   │                          │                           │
   │── create_campaign ───────►│                           │
   │── add_milestone ──────────►│                           │
   │                          │◄─── contribute ────────────│
   │                          │   (funds → escrow)         │
   │── start_campaign ─────────►│                           │
   │                          │                           │
   │── submit_milestone ───────►│                           │
   │   (proof URL)            │──── voting opens ─────────►│
   │                          │                           │
   │                          │◄─── vote_milestone ────────│
   │                          │   (yes/no per backer)      │
   │                          │                           │
   │                     [7 days pass]                    │
   │                          │                           │
   │       [anyone]──finalize_milestone──►│               │
   │                          │ (check quorum + 60% yes)  │
   │                          │                           │
   │── release_milestone_funds►│                           │
   │   (funds leave escrow)   │                           │
   │◄─ [XLM transferred] ─────│                           │
```

## Escrow Mechanism

- Contributions go directly into `escrowed` balance
- Funds only leave escrow on milestone approval
- If campaign fails/cancelled → backers can `claim_refund`
- Pro-rata refund based on remaining escrow

## Voting Governance

- Quorum: 50% of backers must vote
- Approval: 60% of votes must be YES
- Window: 7 days after proof submission
- Anti-double-vote: tracked per (campaign, milestone, voter)

## Contract Security

- `require_auth()` on all write functions
- Only creator can submit/cancel/release
- Only backers can vote
- Refund claimed flag prevents double-claim
- Milestone amounts validated against campaign goal

## Data Storage

| Key Pattern | Data | TTL |
|---|---|---|
| `Campaign(id)` | Campaign struct | 500k ledgers |
| `Milestone(cid, mid)` | Milestone struct | 500k ledgers |
| `Contribution(cid, addr)` | i128 amount | 500k ledgers |
| `HasVoted(cid, mid, addr)` | bool | 500k ledgers |
| `CampaignBackers(cid)` | Vec<Address> | 500k ledgers |
| `RefundClaimed(cid, addr)` | bool | 500k ledgers |
