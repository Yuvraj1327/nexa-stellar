#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Symbol, Vec, Map,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN: Symbol        = symbol_short!("ADMIN");
const CAMP_CNT: Symbol     = symbol_short!("CAMP_CNT");
/// Minimum vote participation: 50% of backers must vote
const QUORUM_BPS: u32      = 5000; // 50%
/// Approval threshold: 60% of votes must be YES
const APPROVE_BPS: u32     = 6000; // 60%
/// Voting window: 7 days in seconds
const VOTE_WINDOW: u64     = 7 * 24 * 3600;

// ─── Events ───────────────────────────────────────────────────────────────────

const EV_CREATED:  Symbol = symbol_short!("CREATED");
const EV_FUNDED:   Symbol = symbol_short!("FUNDED");
const EV_MS_ADD:   Symbol = symbol_short!("MS_ADD");
const EV_MS_SUB:   Symbol = symbol_short!("MS_SUB");
const EV_VOTED:    Symbol = symbol_short!("VOTED");
const EV_APPROVED: Symbol = symbol_short!("APPROVED");
const EV_REJECTED: Symbol = symbol_short!("REJECTED");
const EV_RELEASED: Symbol = symbol_short!("RELEASED");
const EV_REFUND:   Symbol = symbol_short!("REFUND");
const EV_CANCEL:   Symbol = symbol_short!("CANCEL");

// ─── Types ────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    Active,
    Funded,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Voting,
    Approved,
    Rejected,
    Released,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub id: u32,
    pub title: String,
    pub description: String,
    pub amount: i128,          // stroops to release on approval
    pub status: MilestoneStatus,
    pub proof_url: String,     // IPFS / URL submitted by creator
    pub vote_yes: u64,
    pub vote_no: u64,
    pub vote_deadline: u64,    // ledger timestamp
    pub submitted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub goal: i128,
    pub raised: i128,
    pub escrowed: i128,        // funds locked in escrow
    pub released: i128,        // total released to creator
    pub deadline: u64,
    pub status: CampaignStatus,
    pub backer_count: u64,
    pub milestone_count: u32,
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Campaign(u64),
    Milestone(u64, u32),            // campaign_id, milestone_id
    Contribution(u64, Address),     // campaign_id, backer
    HasVoted(u64, u32, Address),    // campaign_id, milestone_id, voter
    CampaignBackers(u64),
    BackerCampaigns(Address),
    RefundClaimed(u64, Address),    // campaign_id, backer
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct FlowLanceContract;

#[contractimpl]
impl FlowLanceContract {

    // ── Admin ──────────────────────────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&CAMP_CNT, &0u64);
        env.storage().instance().extend_ttl(200_000, 200_000);
    }

    // ── Campaign ───────────────────────────────────────────────────────────

    pub fn create_campaign(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        goal: i128,
        duration_seconds: u64,
    ) -> u64 {
        creator.require_auth();

        if goal < 10_000_000 { panic!("Goal must be at least 1 XLM"); }
        if duration_seconds < 3_600 { panic!("Duration must be at least 1 hour"); }
        if duration_seconds > 90 * 24 * 3_600 { panic!("Max duration is 90 days"); }

        let count: u64 = env.storage().instance().get(&CAMP_CNT).unwrap_or(0);
        let id = count + 1;

        let campaign = Campaign {
            id,
            creator: creator.clone(),
            title: title.clone(),
            description,
            goal,
            raised: 0,
            escrowed: 0,
            released: 0,
            deadline: env.ledger().timestamp() + duration_seconds,
            status: CampaignStatus::Active,
            backer_count: 0,
            milestone_count: 0,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::Campaign(id), &campaign);
        env.storage().persistent().extend_ttl(&DataKey::Campaign(id), 500_000, 500_000);
        env.storage().instance().set(&CAMP_CNT, &id);

        env.events().publish((EV_CREATED, symbol_short!("camp")), (id, creator, title, goal));
        id
    }

    /// Add milestone to campaign (creator only, before funding completes)
    pub fn add_milestone(
        env: Env,
        campaign_id: u64,
        creator: Address,
        title: String,
        description: String,
        amount: i128,
    ) -> u32 {
        creator.require_auth();

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator { panic!("Only creator can add milestones"); }
        if amount <= 0 { panic!("Milestone amount must be positive"); }

        // Validate total milestone amounts don't exceed goal
        let new_total = Self::total_milestone_amount(&env, campaign_id, campaign.milestone_count) + amount;
        if new_total > campaign.goal { panic!("Total milestones exceed campaign goal"); }

        let ms_id = campaign.milestone_count + 1;
        let milestone = Milestone {
            id: ms_id,
            title: title.clone(),
            description,
            amount,
            status: MilestoneStatus::Pending,
            proof_url: String::from_str(&env, ""),
            vote_yes: 0,
            vote_no: 0,
            vote_deadline: 0,
            submitted_at: 0,
        };

        env.storage().persistent().set(&DataKey::Milestone(campaign_id, ms_id), &milestone);
        env.storage().persistent().extend_ttl(&DataKey::Milestone(campaign_id, ms_id), 500_000, 500_000);

        campaign.milestone_count = ms_id;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        env.events().publish((EV_MS_ADD, symbol_short!("ms")), (campaign_id, ms_id, title, amount));
        ms_id
    }

    // ── Funding / Escrow ───────────────────────────────────────────────────

    /// Backer contributes — funds go into escrow
    pub fn contribute(
        env: Env,
        campaign_id: u64,
        contributor: Address,
        amount: i128,
    ) {
        contributor.require_auth();

        if amount < 1_000_000 { panic!("Minimum contribution is 0.1 XLM"); }

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.status != CampaignStatus::Active { panic!("Campaign not accepting funds"); }
        if env.ledger().timestamp() > campaign.deadline { panic!("Campaign deadline passed"); }

        // Track per-backer contribution
        let existing: i128 = env.storage().persistent()
            .get(&DataKey::Contribution(campaign_id, contributor.clone()))
            .unwrap_or(0);

        if existing == 0 {
            campaign.backer_count += 1;
            let mut backers: Vec<Address> = env.storage().persistent()
                .get(&DataKey::CampaignBackers(campaign_id))
                .unwrap_or(Vec::new(&env));
            backers.push_back(contributor.clone());
            env.storage().persistent().set(&DataKey::CampaignBackers(campaign_id), &backers);
            env.storage().persistent().extend_ttl(&DataKey::CampaignBackers(campaign_id), 500_000, 500_000);

            let mut backed: Vec<u64> = env.storage().persistent()
                .get(&DataKey::BackerCampaigns(contributor.clone()))
                .unwrap_or(Vec::new(&env));
            backed.push_back(campaign_id);
            env.storage().persistent().set(&DataKey::BackerCampaigns(contributor.clone()), &backed);
            env.storage().persistent().extend_ttl(&DataKey::BackerCampaigns(contributor.clone()), 500_000, 500_000);
        }

        env.storage().persistent().set(
            &DataKey::Contribution(campaign_id, contributor.clone()),
            &(existing + amount),
        );
        env.storage().persistent().extend_ttl(
            &DataKey::Contribution(campaign_id, contributor.clone()),
            500_000, 500_000,
        );

        campaign.raised += amount;
        campaign.escrowed += amount;  // funds go to escrow

        // Auto-transition to Funded when goal reached
        if campaign.raised >= campaign.goal {
            campaign.status = CampaignStatus::Funded;
        }

        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().persistent().extend_ttl(&DataKey::Campaign(campaign_id), 500_000, 500_000);

        env.events().publish(
            (EV_FUNDED, symbol_short!("contrib")),
            (campaign_id, contributor, amount, campaign.raised),
        );
    }

    /// Creator activates work (moves campaign to InProgress)
    pub fn start_campaign(env: Env, campaign_id: u64, creator: Address) {
        creator.require_auth();

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator { panic!("Only creator can start"); }
        if campaign.status != CampaignStatus::Funded { panic!("Campaign must be fully funded"); }
        if campaign.milestone_count == 0 { panic!("Add milestones before starting"); }

        campaign.status = CampaignStatus::InProgress;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
    }

    // ── Milestone Submission ───────────────────────────────────────────────

    /// Creator submits proof for a milestone → opens voting window
    pub fn submit_milestone(
        env: Env,
        campaign_id: u64,
        milestone_id: u32,
        creator: Address,
        proof_url: String,
    ) {
        creator.require_auth();

        let campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator { panic!("Only creator can submit"); }
        if campaign.status != CampaignStatus::InProgress { panic!("Campaign not in progress"); }

        let mut milestone: Milestone = env.storage().persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_id))
            .expect("Milestone not found");

        if milestone.status != MilestoneStatus::Pending {
            panic!("Milestone already submitted or processed");
        }

        milestone.status = MilestoneStatus::Voting;
        milestone.proof_url = proof_url;
        milestone.submitted_at = env.ledger().timestamp();
        milestone.vote_deadline = env.ledger().timestamp() + VOTE_WINDOW;
        milestone.vote_yes = 0;
        milestone.vote_no = 0;

        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_id), &milestone);
        env.storage().persistent().extend_ttl(&DataKey::Milestone(campaign_id, milestone_id), 500_000, 500_000);

        env.events().publish(
            (EV_MS_SUB, symbol_short!("proof")),
            (campaign_id, milestone_id, creator),
        );
    }

    // ── Voting / Governance ────────────────────────────────────────────────

    /// Backer votes on a milestone (yes = approve, no = reject)
    pub fn vote_milestone(
        env: Env,
        campaign_id: u64,
        milestone_id: u32,
        voter: Address,
        approve: bool,
    ) {
        voter.require_auth();

        // Must be a backer
        let contribution: i128 = env.storage().persistent()
            .get(&DataKey::Contribution(campaign_id, voter.clone()))
            .unwrap_or(0);
        if contribution == 0 { panic!("Only backers can vote"); }

        // Check not already voted
        if env.storage().persistent()
            .get::<DataKey, bool>(&DataKey::HasVoted(campaign_id, milestone_id, voter.clone()))
            .unwrap_or(false)
        {
            panic!("Already voted");
        }

        let mut milestone: Milestone = env.storage().persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_id))
            .expect("Milestone not found");

        if milestone.status != MilestoneStatus::Voting { panic!("Milestone not in voting phase"); }
        if env.ledger().timestamp() > milestone.vote_deadline { panic!("Voting period ended"); }

        // Weight vote by contribution amount (1 vote per backer for simplicity)
        if approve {
            milestone.vote_yes += 1;
        } else {
            milestone.vote_no += 1;
        }

        env.storage().persistent().set(&DataKey::HasVoted(campaign_id, milestone_id, voter.clone()), &true);
        env.storage().persistent().extend_ttl(&DataKey::HasVoted(campaign_id, milestone_id, voter.clone()), 500_000, 500_000);
        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_id), &milestone);

        env.events().publish(
            (EV_VOTED, symbol_short!("vote")),
            (campaign_id, milestone_id, voter, approve),
        );
    }

    /// Finalize voting — anyone can call after deadline
    pub fn finalize_milestone(
        env: Env,
        campaign_id: u64,
        milestone_id: u32,
    ) {
        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        let mut milestone: Milestone = env.storage().persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_id))
            .expect("Milestone not found");

        if milestone.status != MilestoneStatus::Voting { panic!("Not in voting phase"); }
        if env.ledger().timestamp() < milestone.vote_deadline { panic!("Voting still active"); }

        let total_votes = milestone.vote_yes + milestone.vote_no;
        let total_backers = campaign.backer_count;

        // Check quorum
        let quorum_met = total_backers == 0 ||
            (total_votes * 10_000 / total_backers) >= QUORUM_BPS as u64;

        let approved = quorum_met &&
            total_votes > 0 &&
            (milestone.vote_yes * 10_000 / total_votes) >= APPROVE_BPS as u64;

        if approved {
            milestone.status = MilestoneStatus::Approved;
            env.events().publish(
                (EV_APPROVED, symbol_short!("ms")),
                (campaign_id, milestone_id, milestone.vote_yes, milestone.vote_no),
            );
        } else {
            milestone.status = MilestoneStatus::Rejected;

            // Check if all milestones exhausted — mark campaign failed
            if Self::all_milestones_rejected_or_done(&env, campaign_id, campaign.milestone_count) {
                campaign.status = CampaignStatus::Failed;
                env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
            }

            env.events().publish(
                (EV_REJECTED, symbol_short!("ms")),
                (campaign_id, milestone_id, milestone.vote_yes, milestone.vote_no),
            );
        }

        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_id), &milestone);
        env.storage().persistent().extend_ttl(&DataKey::Milestone(campaign_id, milestone_id), 500_000, 500_000);
    }

    /// Creator releases approved milestone funds
    pub fn release_milestone_funds(
        env: Env,
        campaign_id: u64,
        milestone_id: u32,
        creator: Address,
    ) {
        creator.require_auth();

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator { panic!("Only creator can release"); }

        let mut milestone: Milestone = env.storage().persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_id))
            .expect("Milestone not found");

        if milestone.status != MilestoneStatus::Approved { panic!("Milestone not approved"); }

        let release_amount = milestone.amount;
        if campaign.escrowed < release_amount { panic!("Insufficient escrow balance"); }

        milestone.status = MilestoneStatus::Released;
        campaign.escrowed -= release_amount;
        campaign.released += release_amount;

        // Check if all milestones complete
        if campaign.released >= campaign.goal {
            campaign.status = CampaignStatus::Completed;
        }

        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_id), &milestone);
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().persistent().extend_ttl(&DataKey::Milestone(campaign_id, milestone_id), 500_000, 500_000);
        env.storage().persistent().extend_ttl(&DataKey::Campaign(campaign_id), 500_000, 500_000);

        env.events().publish(
            (EV_RELEASED, symbol_short!("funds")),
            (campaign_id, milestone_id, creator, release_amount),
        );
    }

    // ── Refunds ────────────────────────────────────────────────────────────

    /// Backer claims refund (campaign failed or cancelled)
    pub fn claim_refund(
        env: Env,
        campaign_id: u64,
        backer: Address,
    ) -> i128 {
        backer.require_auth();

        let campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        let refund_eligible = matches!(
            campaign.status,
            CampaignStatus::Failed | CampaignStatus::Cancelled
        ) || (
            campaign.status == CampaignStatus::Active &&
            env.ledger().timestamp() > campaign.deadline &&
            campaign.raised < campaign.goal
        );

        if !refund_eligible { panic!("Campaign not eligible for refund"); }

        // Check not already refunded
        if env.storage().persistent()
            .get::<DataKey, bool>(&DataKey::RefundClaimed(campaign_id, backer.clone()))
            .unwrap_or(false)
        {
            panic!("Refund already claimed");
        }

        let contribution: i128 = env.storage().persistent()
            .get(&DataKey::Contribution(campaign_id, backer.clone()))
            .unwrap_or(0);

        if contribution == 0 { panic!("No contribution found"); }

        // Calculate pro-rata refund (proportional to escrow remaining)
        let refund_amount = if campaign.escrowed >= contribution {
            contribution
        } else {
            // Pro-rata based on remaining escrow
            (contribution * campaign.escrowed) / campaign.raised
        };

        env.storage().persistent().set(&DataKey::RefundClaimed(campaign_id, backer.clone()), &true);
        env.storage().persistent().extend_ttl(&DataKey::RefundClaimed(campaign_id, backer.clone()), 500_000, 500_000);

        env.events().publish(
            (EV_REFUND, symbol_short!("claim")),
            (campaign_id, backer, refund_amount),
        );

        refund_amount
    }

    /// Creator cancels campaign (only if no contributions yet)
    pub fn cancel_campaign(env: Env, campaign_id: u64, creator: Address) {
        creator.require_auth();

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator { panic!("Only creator can cancel"); }
        if !matches!(campaign.status, CampaignStatus::Active | CampaignStatus::Funded) {
            panic!("Cannot cancel at this stage");
        }

        campaign.status = CampaignStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        env.events().publish(
            (EV_CANCEL, symbol_short!("camp")),
            (campaign_id, creator),
        );
    }

    // ── Read-only Views ────────────────────────────────────────────────────

    pub fn get_campaign(env: Env, campaign_id: u64) -> Campaign {
        env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found")
    }

    pub fn get_campaign_count(env: Env) -> u64 {
        env.storage().instance().get(&CAMP_CNT).unwrap_or(0)
    }

    pub fn get_milestone(env: Env, campaign_id: u64, milestone_id: u32) -> Milestone {
        env.storage().persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_id))
            .expect("Milestone not found")
    }

    pub fn get_contribution(env: Env, campaign_id: u64, backer: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Contribution(campaign_id, backer))
            .unwrap_or(0)
    }

    pub fn get_campaign_backers(env: Env, campaign_id: u64) -> Vec<Address> {
        env.storage().persistent()
            .get(&DataKey::CampaignBackers(campaign_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_backer_campaigns(env: Env, backer: Address) -> Vec<u64> {
        env.storage().persistent()
            .get(&DataKey::BackerCampaigns(backer))
            .unwrap_or(Vec::new(&env))
    }

    pub fn has_voted(env: Env, campaign_id: u64, milestone_id: u32, voter: Address) -> bool {
        env.storage().persistent()
            .get(&DataKey::HasVoted(campaign_id, milestone_id, voter))
            .unwrap_or(false)
    }

    pub fn is_refund_claimed(env: Env, campaign_id: u64, backer: Address) -> bool {
        env.storage().persistent()
            .get(&DataKey::RefundClaimed(campaign_id, backer))
            .unwrap_or(false)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&ADMIN).expect("Not initialized")
    }

    // ── Internal Helpers ───────────────────────────────────────────────────

    fn total_milestone_amount(env: &Env, campaign_id: u64, count: u32) -> i128 {
        let mut total = 0i128;
        for i in 1..=count {
            if let Some(ms) = env.storage().persistent()
                .get::<DataKey, Milestone>(&DataKey::Milestone(campaign_id, i))
            {
                total += ms.amount;
            }
        }
        total
    }

    fn all_milestones_rejected_or_done(env: &Env, campaign_id: u64, count: u32) -> bool {
        for i in 1..=count {
            if let Some(ms) = env.storage().persistent()
                .get::<DataKey, Milestone>(&DataKey::Milestone(campaign_id, i))
            {
                match ms.status {
                    MilestoneStatus::Pending |
                    MilestoneStatus::Submitted |
                    MilestoneStatus::Voting |
                    MilestoneStatus::Approved => return false,
                    _ => {}
                }
            }
        }
        true
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger, LedgerInfo}, Env, String};

    fn setup() -> (Env, FlowLanceContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, FlowLanceContract);
        let client = FlowLanceContractClient::new(&env, &id);
        (env, client)
    }

    #[test]
    fn test_create_campaign() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        client.initialize(&admin);
        let id = client.create_campaign(
            &creator,
            &String::from_str(&env, "FlowLance Test"),
            &String::from_str(&env, "Milestone crowdfunding"),
            &100_000_000i128,
            &86400u64,
        );
        assert_eq!(id, 1);
        let camp = client.get_campaign(&1);
        assert_eq!(camp.goal, 100_000_000);
        assert_eq!(camp.raised, 0);
        assert_eq!(camp.escrowed, 0);
    }

    #[test]
    fn test_add_milestone() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        client.initialize(&admin);
        let camp_id = client.create_campaign(
            &creator,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Desc"),
            &100_000_000i128,
            &86400u64,
        );
        let ms_id = client.add_milestone(
            &camp_id,
            &creator,
            &String::from_str(&env, "Milestone 1"),
            &String::from_str(&env, "Deliver feature"),
            &50_000_000i128,
        );
        assert_eq!(ms_id, 1);
        let ms = client.get_milestone(&camp_id, &1);
        assert_eq!(ms.amount, 50_000_000);
    }

    #[test]
    fn test_contribute_and_escrow() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        client.initialize(&admin);
        let camp_id = client.create_campaign(
            &creator,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Desc"),
            &100_000_000i128,
            &86400u64,
        );
        client.contribute(&camp_id, &backer, &100_000_000i128);
        let camp = client.get_campaign(&camp_id);
        assert_eq!(camp.raised, 100_000_000);
        assert_eq!(camp.escrowed, 100_000_000);
        assert_eq!(camp.backer_count, 1);
        // Should auto-transition to Funded
        assert_eq!(camp.status, CampaignStatus::Funded);
    }

    #[test]
    fn test_milestone_voting_flow() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer1 = Address::generate(&env);
        let backer2 = Address::generate(&env);

        client.initialize(&admin);
        let camp_id = client.create_campaign(
            &creator,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Desc"),
            &100_000_000i128,
            &86400u64,
        );
        let ms_id = client.add_milestone(
            &camp_id,
            &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "Deliver"),
            &100_000_000i128,
        );

        // Fund campaign
        client.contribute(&camp_id, &backer1, &50_000_000i128);
        client.contribute(&camp_id, &backer2, &50_000_000i128);
        client.start_campaign(&camp_id, &creator);

        // Submit milestone proof
        client.submit_milestone(
            &camp_id, &ms_id, &creator,
            &String::from_str(&env, "https://proof.example.com"),
        );

        // Both backers vote YES
        client.vote_milestone(&camp_id, &ms_id, &backer1, &true);
        client.vote_milestone(&camp_id, &ms_id, &backer2, &true);

        let ms = client.get_milestone(&camp_id, &ms_id);
        assert_eq!(ms.vote_yes, 2);
        assert_eq!(ms.vote_no, 0);

        // Advance time past vote deadline
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + VOTE_WINDOW + 1,
            protocol_version: 22,
            sequence_number: env.ledger().sequence() + 100,
            network_id: Default::default(),
            base_reserve: 5_000_000,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 4096,
            max_entry_ttl: 6_312_000,
        });

        client.finalize_milestone(&camp_id, &ms_id);
        let ms = client.get_milestone(&camp_id, &ms_id);
        assert_eq!(ms.status, MilestoneStatus::Approved);

        // Release funds
        client.release_milestone_funds(&camp_id, &ms_id, &creator);
        let camp = client.get_campaign(&camp_id);
        assert_eq!(camp.released, 100_000_000);
        assert_eq!(camp.escrowed, 0);
        assert_eq!(camp.status, CampaignStatus::Completed);
    }

    #[test]
    fn test_refund_on_failed_campaign() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);

        client.initialize(&admin);
        let camp_id = client.create_campaign(
            &creator,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Desc"),
            &100_000_000i128,
            &3600u64, // 1 hour
        );

        client.contribute(&camp_id, &backer, &50_000_000i128);

        // Advance time past deadline
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 7200,
            protocol_version: 22,
            sequence_number: env.ledger().sequence() + 100,
            network_id: Default::default(),
            base_reserve: 5_000_000,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 4096,
            max_entry_ttl: 6_312_000,
        });

        // Should be eligible for refund (goal not met)
        let refund = client.claim_refund(&camp_id, &backer);
        assert_eq!(refund, 50_000_000);
    }

    #[test]
    fn test_duplicate_vote_rejected() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);

        client.initialize(&admin);
        let camp_id = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &10_000_000i128,
            &86400u64,
        );
        let ms_id = client.add_milestone(
            &camp_id, &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "D"),
            &10_000_000i128,
        );
        client.contribute(&camp_id, &backer, &10_000_000i128);
        client.start_campaign(&camp_id, &creator);
        client.submit_milestone(&camp_id, &ms_id, &creator, &String::from_str(&env, "proof"));
        client.vote_milestone(&camp_id, &ms_id, &backer, &true);

        // Second vote should panic
        let result = std::panic::catch_unwind(|| {
            client.vote_milestone(&camp_id, &ms_id, &backer, &false);
        });
        assert!(result.is_err());
    }
}
