# Git Commit Plan — nexa-stellar

## Commit 1: Project Setup & Wallet Integration
```
feat: initialize Next.js 15 project with Stellar wallet integration

- Set up Next.js 15 with TypeScript and Tailwind CSS
- Configure StellarWalletsKit with multi-wallet support
- Implement wallet store (Zustand) with connect/disconnect
- Add WalletButton component with address display and balance
- Set up TanStack Query provider
- Add contract config with testnet defaults
- Add stellar-utils (XLM conversions, address formatting)
- Add .env.example and .gitignore
```

## Commit 2: Soroban Smart Contract & Deployment
```
feat: implement crowdfunding Soroban smart contract

- Write Rust contract with Campaign struct and lifecycle
- Implement create_campaign, contribute, claim_funds, cancel
- Add contract events (CAMP_NEW, CAMP_FUND, CAMP_CLAM, etc.)
- Add read-only views (get_campaign, get_contribution, etc.)
- Write unit tests for all contract functions
- Add deploy.mjs script with full deployment pipeline
- Add contract Cargo.toml with soroban-sdk v22
```

## Commit 3: Frontend Contract Integration
```
feat: integrate Soroban contract with Next.js frontend

- Implement soroban-client.ts with RPC simulation
- Add transaction builders for all contract functions
- Implement submitAndTrack with status polling
- Add use-campaigns.ts TanStack Query hooks
- Implement transaction store with persistence
- Add CampaignCard with progress bars and status
- Add CreateCampaignModal and ContributeModal
- Add all pages: Home, Campaigns, Campaign Detail
```

## Commit 4: Real-time Events & Transaction Tracking
```
feat: add real-time event feed and transaction history

- Implement fetchContractEvents via Soroban RPC getEvents
- Add use-events.ts with 15s polling
- Build Activity Feed page with event type legends
- Add Transaction History page with status indicators
- Add Wallet Dashboard with portfolio overview
- Implement toast notification system
- Add explorer deep links for all entities
```

## Commit 5: UI Polish & Documentation
```
chore: polish UI, finalize documentation

- Add skeleton loaders for loading states
- Add empty states with helpful CTAs
- Implement dark gradient background system
- Add Header with active nav indicators
- Add network badge and contract link in UI
- Add error handling with user-friendly messages
- Complete README with setup guide and architecture
- Add git commit plan
```
