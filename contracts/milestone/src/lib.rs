#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Symbol, Vec,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN: Symbol    = symbol_short!("ADMIN");
const CAMP_CNT: Symbol = symbol_short!("CAMPCNT");

/// Quorum: 50% of backers must vote
const QUORUM_BPS: u64 = 5_000;
/// Approval: 60% YES required
const APPROVE_BPS: u64 = 6_000;
/// Voting window: 7 days
const VOTE_WINDOW: u64 = 7 * 24 * 3_600;

// ─── Events ───────────────────────────────────────────────────────────────────

const EV_CAMP_CREATED:  Symbol = symbol_short!("CAMPCRTD");
const EV_CONTRIBUTED:   Symbol = symbol_short!("CONTRIB");
const EV_MS_SUBMITTED:  Symbol = symbol_short!("MSSUB");
const EV_VOTE_CAST:     Symbol = symbol_short!("VOTECAST");
const EV_MS_APPROVED:   Symbol = symbol_short!("MSAPRVD");
const EV_MS_REJECTED:   Symbol = symbol_short!("MSRJCTD");
const EV_FUNDS_RELEASED:Symbol = symbol_short!("FUNDSREL");
const EV_REFUND_ISSUED: Symbol = symbol_short!("REFUND");
const EV_CAMP_COMPLETE: Symbol = symbol_short!("CAMPDONE");
const EV_CANCELLED:     Symbol = symbol_short!("CANCELD");

// ─── Storage Types ────────────────────────────────────────────────────────────

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
    Voting,
    Approved,
    Rejected,
    Released,
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
    pub escrowed: i128,
    pub released: i128,
    pub deadline: u64,
    pub status: CampaignStatus,
    pub backer_count: u64,
    pub milestone_count: u32,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub id: u32,
    pub title: String,
    pub description: String,
    pub amount: i128,
    pub status: MilestoneStatus,
    pub proof_url: String,
    pub vote_yes: u64,
    pub vote_no: u64,
    pub vote_deadline: u64,
    pub submitted_at: u64,
}

#[contracttype]
pub enum DataKey {
    Campaign(u64),
    Milestone(u64, u32),
    Contribution(u64, Address),
    HasVoted(u64, u32, Address),
    CampaignBackers(u64),
    BackerCampaigns(Address),
    RefundClaimed(u64, Address),
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct NexaMilestoneContract;

#[contractimpl]
impl NexaMilestoneContract {

    /// One-time initialization
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&CAMP_CNT, &0u64);
        env.storage().instance().extend_ttl(500_000, 500_000);
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

        if goal < 10_000_000 { panic!("Minimum goal: 1 XLM"); }
        if duration_seconds < 3_600 { panic!("Minimum duration: 1 hour"); }
        if duration_seconds > 7_776_000 { panic!("Maximum duration: 90 days"); }

        let count: u64 = env.storage().instance().get(&CAMP_CNT).unwrap_or(0);
        let id = count + 1;

        let campaign = Campaign {
            id,
            creator: creator.clone(),
            title: title.clone(),
            description: description.clone(),
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
        env.storage().instance().extend_ttl(500_000, 500_000);

        env.events().publish(
            (EV_CAMP_CREATED, symbol_short!("v1")),
            (id, creator, title, goal, env.ledger().timestamp() + duration_seconds),
        );
        id
    }

    /// Add a milestone (creator only, while Active or Funded)
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

        if campaign.creator != creator { panic!("Unauthorized"); }
        if !matches!(campaign.status, CampaignStatus::Active | CampaignStatus::Funded) {
            panic!("Cannot add milestone at this stage");
        }
        if amount <= 0 { panic!("Amount must be positive"); }

        // Validate total milestone amounts ≤ goal
        let existing_total = Self::sum_milestone_amounts(&env, campaign_id, campaign.milestone_count);
        if existing_total + amount > campaign.goal {
            panic!("Total milestone amounts exceed campaign goal");
        }

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
        env.storage().persistent().extend_ttl(&DataKey::Campaign(campaign_id), 500_000, 500_000);

        ms_id
    }

    // ── Funding / Escrow ───────────────────────────────────────────────────

    /// Backer contributes XLM — goes into escrow
    pub fn contribute(
        env: Env,
        campaign_id: u64,
        contributor: Address,
        amount: i128,
    ) {
        contributor.require_auth();

        if amount < 1_000_000 { panic!("Minimum contribution: 0.1 XLM"); }

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.status != CampaignStatus::Active { panic!("Campaign not accepting funds"); }
        if env.ledger().timestamp() > campaign.deadline { panic!("Campaign deadline passed"); }

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
        campaign.escrowed += amount;

        if campaign.raised >= campaign.goal {
            campaign.status = CampaignStatus::Funded;
        }

        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().persistent().extend_ttl(&DataKey::Campaign(campaign_id), 500_000, 500_000);

        env.events().publish(
            (EV_CONTRIBUTED, symbol_short!("v1")),
            (campaign_id, contributor, amount, campaign.raised),
        );
    }

    /// Creator starts work (Funded → InProgress)
    pub fn start_campaign(env: Env, campaign_id: u64, creator: Address) {
        creator.require_auth();

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator { panic!("Unauthorized"); }
        if campaign.status != CampaignStatus::Funded { panic!("Must be fully funded"); }
        if campaign.milestone_count == 0 { panic!("Add at least one milestone first"); }

        campaign.status = CampaignStatus::InProgress;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().persistent().extend_ttl(&DataKey::Campaign(campaign_id), 500_000, 500_000);
    }

    // ── Milestone Lifecycle ────────────────────────────────────────────────

    /// Creator submits proof → opens 7-day voting window
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

        if campaign.creator != creator { panic!("Unauthorized"); }
        if campaign.status != CampaignStatus::InProgress { panic!("Campaign not in progress"); }

        let mut milestone: Milestone = env.storage().persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_id))
            .expect("Milestone not found");

        if milestone.status != MilestoneStatus::Pending {
            panic!("Milestone already processed");
        }
        if proof_url.len() == 0 { panic!("Proof URL required"); }

        milestone.status = MilestoneStatus::Voting;
        milestone.proof_url = proof_url;
        milestone.submitted_at = env.ledger().timestamp();
        milestone.vote_deadline = env.ledger().timestamp() + VOTE_WINDOW;
        milestone.vote_yes = 0;
        milestone.vote_no = 0;

        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_id), &milestone);
        env.storage().persistent().extend_ttl(&DataKey::Milestone(campaign_id, milestone_id), 500_000, 500_000);

        env.events().publish(
            (EV_MS_SUBMITTED, symbol_short!("v1")),
            (campaign_id, milestone_id, creator, milestone.vote_deadline),
        );
    }

    /// Backer votes on milestone (one vote per backer)
    pub fn vote_milestone(
        env: Env,
        campaign_id: u64,
        milestone_id: u32,
        voter: Address,
        approve: bool,
    ) {
        voter.require_auth();

        // Must be a backer with contribution
        let contribution: i128 = env.storage().persistent()
            .get(&DataKey::Contribution(campaign_id, voter.clone()))
            .unwrap_or(0);
        if contribution == 0 { panic!("Only backers can vote"); }

        // Prevent double voting
        if env.storage().persistent()
            .get::<DataKey, bool>(&DataKey::HasVoted(campaign_id, milestone_id, voter.clone()))
            .unwrap_or(false)
        {
            panic!("Already voted on this milestone");
        }

        let mut milestone: Milestone = env.storage().persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_id))
            .expect("Milestone not found");

        if milestone.status != MilestoneStatus::Voting { panic!("Milestone not in voting phase"); }
        if env.ledger().timestamp() > milestone.vote_deadline { panic!("Voting period ended"); }

        if approve {
            milestone.vote_yes += 1;
        } else {
            milestone.vote_no += 1;
        }

        env.storage().persistent().set(
            &DataKey::HasVoted(campaign_id, milestone_id, voter.clone()),
            &true,
        );
        env.storage().persistent().extend_ttl(
            &DataKey::HasVoted(campaign_id, milestone_id, voter.clone()),
            500_000, 500_000,
        );
        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_id), &milestone);
        env.storage().persistent().extend_ttl(&DataKey::Milestone(campaign_id, milestone_id), 500_000, 500_000);

        env.events().publish(
            (EV_VOTE_CAST, symbol_short!("v1")),
            (campaign_id, milestone_id, voter, approve),
        );
    }

    /// Finalize voting result — callable by anyone after deadline
    pub fn finalize_milestone(env: Env, campaign_id: u64, milestone_id: u32) {
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

        let quorum_met = total_backers == 0 ||
            (total_votes * 10_000 / total_backers.max(1)) >= QUORUM_BPS;

        let approved = quorum_met
            && total_votes > 0
            && (milestone.vote_yes * 10_000 / total_votes.max(1)) >= APPROVE_BPS;

        if approved {
            milestone.status = MilestoneStatus::Approved;
            env.events().publish(
                (EV_MS_APPROVED, symbol_short!("v1")),
                (campaign_id, milestone_id, milestone.vote_yes, milestone.vote_no),
            );
        } else {
            milestone.status = MilestoneStatus::Rejected;

            // Check if all milestones are done → campaign failed
            if Self::all_milestones_terminal(&env, campaign_id, campaign.milestone_count) {
                campaign.status = CampaignStatus::Failed;
                env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
                env.storage().persistent().extend_ttl(&DataKey::Campaign(campaign_id), 500_000, 500_000);
            }

            env.events().publish(
                (EV_MS_REJECTED, symbol_short!("v1")),
                (campaign_id, milestone_id, milestone.vote_yes, milestone.vote_no),
            );
        }

        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_id), &milestone);
        env.storage().persistent().extend_ttl(&DataKey::Milestone(campaign_id, milestone_id), 500_000, 500_000);
    }

    /// Creator claims approved milestone funds from escrow
    pub fn release_milestone(
        env: Env,
        campaign_id: u64,
        milestone_id: u32,
        creator: Address,
    ) {
        creator.require_auth();

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator { panic!("Unauthorized"); }

        let mut milestone: Milestone = env.storage().persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_id))
            .expect("Milestone not found");

        if milestone.status != MilestoneStatus::Approved { panic!("Milestone not approved"); }
        if campaign.escrowed < milestone.amount { panic!("Insufficient escrow"); }

        campaign.escrowed -= milestone.amount;
        campaign.released += milestone.amount;
        milestone.status = MilestoneStatus::Released;

        // Check if all milestones released → complete
        if campaign.released >= campaign.goal || Self::all_milestones_terminal(&env, campaign_id, campaign.milestone_count) {
            campaign.status = CampaignStatus::Completed;
            env.events().publish(
                (EV_CAMP_COMPLETE, symbol_short!("v1")),
                (campaign_id, creator.clone(), campaign.released),
            );
        }

        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_id), &milestone);
        env.storage().persistent().extend_ttl(&DataKey::Milestone(campaign_id, milestone_id), 500_000, 500_000);
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().persistent().extend_ttl(&DataKey::Campaign(campaign_id), 500_000, 500_000);

        env.events().publish(
            (EV_FUNDS_RELEASED, symbol_short!("v1")),
            (campaign_id, milestone_id, creator, milestone.amount),
        );
    }

    // ── Refunds ────────────────────────────────────────────────────────────

    /// Backer claims refund when campaign failed / cancelled / expired
    pub fn claim_refund(env: Env, campaign_id: u64, backer: Address) -> i128 {
        backer.require_auth();

        let campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        // Eligible if: Failed, Cancelled, or Active but past deadline with unmet goal
        let eligible = matches!(campaign.status, CampaignStatus::Failed | CampaignStatus::Cancelled)
            || (campaign.status == CampaignStatus::Active
                && env.ledger().timestamp() > campaign.deadline
                && campaign.raised < campaign.goal);

        if !eligible { panic!("Campaign not eligible for refund"); }

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

        // Pro-rata refund based on remaining escrow
        let refund = if campaign.escrowed == 0 {
            0
        } else if campaign.escrowed >= contribution {
            contribution
        } else {
            (contribution * campaign.escrowed) / campaign.raised.max(1)
        };

        env.storage().persistent().set(&DataKey::RefundClaimed(campaign_id, backer.clone()), &true);
        env.storage().persistent().extend_ttl(&DataKey::RefundClaimed(campaign_id, backer.clone()), 500_000, 500_000);

        env.events().publish(
            (EV_REFUND_ISSUED, symbol_short!("v1")),
            (campaign_id, backer, refund),
        );

        refund
    }

    /// Cancel campaign — creator only, refunds become available
    pub fn cancel_campaign(env: Env, campaign_id: u64, creator: Address) {
        creator.require_auth();

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator { panic!("Unauthorized"); }
        if !matches!(campaign.status, CampaignStatus::Active | CampaignStatus::Funded) {
            panic!("Cannot cancel at this stage");
        }

        campaign.status = CampaignStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().persistent().extend_ttl(&DataKey::Campaign(campaign_id), 500_000, 500_000);

        env.events().publish(
            (EV_CANCELLED, symbol_short!("v1")),
            (campaign_id, creator),
        );
    }

    // ── Read-Only Views ────────────────────────────────────────────────────

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

    pub fn get_backers(env: Env, campaign_id: u64) -> Vec<Address> {
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

    fn sum_milestone_amounts(env: &Env, campaign_id: u64, count: u32) -> i128 {
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

    fn all_milestones_terminal(env: &Env, campaign_id: u64, count: u32) -> bool {
        for i in 1..=count {
            if let Some(ms) = env.storage().persistent()
                .get::<DataKey, Milestone>(&DataKey::Milestone(campaign_id, i))
            {
                match ms.status {
                    MilestoneStatus::Pending | MilestoneStatus::Voting => return false,
                    _ => {}
                }
            }
        }
        true
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        Env, String,
    };

    fn setup() -> (Env, NexaMilestoneContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, NexaMilestoneContract);
        let client = NexaMilestoneContractClient::new(&env, &id);
        (env, client)
    }

    fn advance_time(env: &Env, seconds: u64) {
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + seconds,
            protocol_version: 22,
            sequence_number: env.ledger().sequence() + (seconds / 5) as u32,
            network_id: Default::default(),
            base_reserve: 5_000_000,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 4096,
            max_entry_ttl: 6_312_000,
        });
    }

    #[test]
    fn test_01_initialize() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin);
        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_campaign_count(), 0);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_02_double_initialize_fails() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.initialize(&admin); // should panic
    }

    #[test]
    fn test_03_create_campaign() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        client.initialize(&admin);

        let id = client.create_campaign(
            &creator,
            &String::from_str(&env, "Test Campaign"),
            &String::from_str(&env, "Description"),
            &100_000_000i128,
            &86_400u64,
        );
        assert_eq!(id, 1);
        let c = client.get_campaign(&1);
        assert_eq!(c.goal, 100_000_000);
        assert_eq!(c.raised, 0);
        assert_eq!(c.escrowed, 0);
        assert_eq!(c.status, CampaignStatus::Active);
    }

    #[test]
    fn test_04_add_milestone_and_contribute() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
            &86_400u64,
        );
        let mid = client.add_milestone(
            &cid, &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "Deliver feature"),
            &100_000_000i128,
        );
        assert_eq!(mid, 1);

        client.contribute(&cid, &backer, &100_000_000i128);
        let c = client.get_campaign(&cid);
        assert_eq!(c.raised, 100_000_000);
        assert_eq!(c.escrowed, 100_000_000);
        assert_eq!(c.status, CampaignStatus::Funded);
        assert_eq!(c.backer_count, 1);
    }

    #[test]
    #[should_panic(expected = "Minimum contribution: 0.1 XLM")]
    fn test_05_minimum_contribution_enforced() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        client.initialize(&admin);
        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
            &86_400u64,
        );
        client.contribute(&cid, &backer, &100i128); // too small
    }

    #[test]
    fn test_06_full_milestone_approval_flow() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer1 = Address::generate(&env);
        let backer2 = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
            &86_400u64,
        );
        let mid = client.add_milestone(
            &cid, &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
        );

        client.contribute(&cid, &backer1, &50_000_000i128);
        client.contribute(&cid, &backer2, &50_000_000i128);
        client.start_campaign(&cid, &creator);
        client.submit_milestone(&cid, &mid, &creator, &String::from_str(&env, "https://proof.com"));

        client.vote_milestone(&cid, &mid, &backer1, &true);
        client.vote_milestone(&cid, &mid, &backer2, &true);

        advance_time(&env, VOTE_WINDOW + 1);

        client.finalize_milestone(&cid, &mid);
        let ms = client.get_milestone(&cid, &mid);
        assert_eq!(ms.status, MilestoneStatus::Approved);

        client.release_milestone(&cid, &mid, &creator);
        let c = client.get_campaign(&cid);
        assert_eq!(c.released, 100_000_000);
        assert_eq!(c.escrowed, 0);
        assert_eq!(c.status, CampaignStatus::Completed);
    }

    #[test]
    fn test_07_milestone_rejected_when_votes_fail() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer1 = Address::generate(&env);
        let backer2 = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
            &86_400u64,
        );
        let mid = client.add_milestone(
            &cid, &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
        );

        client.contribute(&cid, &backer1, &50_000_000i128);
        client.contribute(&cid, &backer2, &50_000_000i128);
        client.start_campaign(&cid, &creator);
        client.submit_milestone(&cid, &mid, &creator, &String::from_str(&env, "https://proof.com"));

        // Both vote NO
        client.vote_milestone(&cid, &mid, &backer1, &false);
        client.vote_milestone(&cid, &mid, &backer2, &false);

        advance_time(&env, VOTE_WINDOW + 1);

        client.finalize_milestone(&cid, &mid);
        let ms = client.get_milestone(&cid, &mid);
        assert_eq!(ms.status, MilestoneStatus::Rejected);
        let c = client.get_campaign(&cid);
        assert_eq!(c.status, CampaignStatus::Failed);
    }

    #[test]
    #[should_panic(expected = "Already voted on this milestone")]
    fn test_08_double_vote_prevented() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &10_000_000i128,
            &86_400u64,
        );
        let mid = client.add_milestone(
            &cid, &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "D"),
            &10_000_000i128,
        );

        client.contribute(&cid, &backer, &10_000_000i128);
        client.start_campaign(&cid, &creator);
        client.submit_milestone(&cid, &mid, &creator, &String::from_str(&env, "https://p.com"));
        client.vote_milestone(&cid, &mid, &backer, &true);
        client.vote_milestone(&cid, &mid, &backer, &false); // should panic
    }

    #[test]
    #[should_panic(expected = "Only backers can vote")]
    fn test_09_non_backer_vote_prevented() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        let stranger = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &10_000_000i128,
            &86_400u64,
        );
        let mid = client.add_milestone(
            &cid, &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "D"),
            &10_000_000i128,
        );

        client.contribute(&cid, &backer, &10_000_000i128);
        client.start_campaign(&cid, &creator);
        client.submit_milestone(&cid, &mid, &creator, &String::from_str(&env, "https://p.com"));
        client.vote_milestone(&cid, &mid, &stranger, &true); // should panic
    }

    #[test]
    fn test_10_refund_on_expired_campaign() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
            &3_600u64, // 1 hour
        );
        client.contribute(&cid, &backer, &50_000_000i128);

        // Advance past deadline without hitting goal
        advance_time(&env, 7_200);

        let refund = client.claim_refund(&cid, &backer);
        assert_eq!(refund, 50_000_000);
    }

    #[test]
    #[should_panic(expected = "Refund already claimed")]
    fn test_11_double_refund_prevented() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
            &3_600u64,
        );
        client.contribute(&cid, &backer, &50_000_000i128);
        advance_time(&env, 7_200);

        client.claim_refund(&cid, &backer);
        client.claim_refund(&cid, &backer); // should panic
    }

    #[test]
    fn test_12_cancel_enables_refund() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
            &86_400u64,
        );
        client.contribute(&cid, &backer, &40_000_000i128);
        client.cancel_campaign(&cid, &creator);

        let c = client.get_campaign(&cid);
        assert_eq!(c.status, CampaignStatus::Cancelled);

        let refund = client.claim_refund(&cid, &backer);
        assert_eq!(refund, 40_000_000);
    }

    #[test]
    #[should_panic(expected = "Total milestone amounts exceed campaign goal")]
    fn test_13_milestone_amount_validation() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &100_000_000i128,
            &86_400u64,
        );
        // Add milestone exceeding goal
        client.add_milestone(
            &cid, &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "D"),
            &200_000_000i128, // exceeds 100 XLM goal
        );
    }

    #[test]
    #[should_panic(expected = "Proof URL required")]
    fn test_14_empty_proof_url_rejected() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);
        client.initialize(&admin);

        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &10_000_000i128,
            &86_400u64,
        );
        let mid = client.add_milestone(
            &cid, &creator,
            &String::from_str(&env, "M1"),
            &String::from_str(&env, "D"),
            &10_000_000i128,
        );
        client.contribute(&cid, &backer, &10_000_000i128);
        client.start_campaign(&cid, &creator);
        client.submit_milestone(&cid, &mid, &creator, &String::from_str(&env, "")); // empty
    }
}
