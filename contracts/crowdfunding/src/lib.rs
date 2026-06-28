#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Symbol, Vec, Map,
    log,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

const CAMPAIGN_COUNT: Symbol = symbol_short!("CAMP_CNT");
const ADMIN: Symbol = symbol_short!("ADMIN");

// ─── Data Types ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    Active,
    Successful,
    Failed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub goal: i128,        // in stroops (1 XLM = 10_000_000 stroops)
    pub raised: i128,
    pub deadline: u64,     // ledger timestamp
    pub status: CampaignStatus,
    pub backer_count: u64,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Contribution {
    pub campaign_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Campaign(u64),
    Contribution(u64, Address),    // campaign_id, contributor
    BackerContributions(Address),  // all campaign IDs backed by address
    CampaignBackers(u64),          // all backers for a campaign
}

// ─── Events ──────────────────────────────────────────────────────────────────

const CAMPAIGN_CREATED: Symbol = symbol_short!("CAMP_NEW");
const CAMPAIGN_FUNDED: Symbol = symbol_short!("CAMP_FUND");
const CAMPAIGN_CLAIMED: Symbol = symbol_short!("CAMP_CLAM");
const CAMPAIGN_REFUNDED: Symbol = symbol_short!("CAMP_REF");
const CAMPAIGN_CANCELLED: Symbol = symbol_short!("CAMP_CAN");

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct CrowdfundingContract;

#[contractimpl]
impl CrowdfundingContract {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&CAMPAIGN_COUNT, &0u64);
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    /// Create a new crowdfunding campaign
    pub fn create_campaign(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        goal: i128,
        duration_seconds: u64,
    ) -> u64 {
        creator.require_auth();

        if goal <= 0 {
            panic!("Goal must be positive");
        }
        if duration_seconds < 3600 {
            panic!("Duration must be at least 1 hour");
        }

        let count: u64 = env
            .storage()
            .instance()
            .get(&CAMPAIGN_COUNT)
            .unwrap_or(0);
        let id = count + 1;

        let deadline = env.ledger().timestamp() + duration_seconds;

        let campaign = Campaign {
            id,
            creator: creator.clone(),
            title: title.clone(),
            description,
            goal,
            raised: 0,
            deadline,
            status: CampaignStatus::Active,
            backer_count: 0,
            created_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Campaign(id), &campaign);
        env.storage()
            .instance()
            .set(&CAMPAIGN_COUNT, &id);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Campaign(id), 200_000, 200_000);

        env.events().publish(
            (CAMPAIGN_CREATED, symbol_short!("campaign")),
            (id, creator, title, goal, deadline),
        );

        id
    }

    /// Contribute XLM to a campaign (amount in stroops)
    pub fn contribute(
        env: Env,
        campaign_id: u64,
        contributor: Address,
        amount: i128,
    ) {
        contributor.require_auth();

        if amount <= 0 {
            panic!("Contribution must be positive");
        }

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.status != CampaignStatus::Active {
            panic!("Campaign is not active");
        }
        if env.ledger().timestamp() > campaign.deadline {
            panic!("Campaign deadline has passed");
        }

        // Track per-contributor amount
        let existing: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(campaign_id, contributor.clone()))
            .unwrap_or(0);

        if existing == 0 {
            campaign.backer_count += 1;

            // Track backers list for campaign
            let mut backers: Vec<Address> = env
                .storage()
                .persistent()
                .get(&DataKey::CampaignBackers(campaign_id))
                .unwrap_or(Vec::new(&env));
            backers.push_back(contributor.clone());
            env.storage()
                .persistent()
                .set(&DataKey::CampaignBackers(campaign_id), &backers);
            env.storage()
                .persistent()
                .extend_ttl(&DataKey::CampaignBackers(campaign_id), 200_000, 200_000);

            // Track campaigns backed by contributor
            let mut backed: Vec<u64> = env
                .storage()
                .persistent()
                .get(&DataKey::BackerContributions(contributor.clone()))
                .unwrap_or(Vec::new(&env));
            backed.push_back(campaign_id);
            env.storage()
                .persistent()
                .set(&DataKey::BackerContributions(contributor.clone()), &backed);
            env.storage()
                .persistent()
                .extend_ttl(&DataKey::BackerContributions(contributor.clone()), 200_000, 200_000);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Contribution(campaign_id, contributor.clone()), &(existing + amount));
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Contribution(campaign_id, contributor.clone()), 200_000, 200_000);

        campaign.raised += amount;

        // Auto-mark successful if goal reached
        if campaign.raised >= campaign.goal {
            campaign.status = CampaignStatus::Successful;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Campaign(campaign_id), 200_000, 200_000);

        env.events().publish(
            (CAMPAIGN_FUNDED, symbol_short!("contribute")),
            (campaign_id, contributor, amount, campaign.raised),
        );
    }

    /// Creator claims funds after successful campaign
    pub fn claim_funds(env: Env, campaign_id: u64, creator: Address) {
        creator.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator {
            panic!("Only the creator can claim funds");
        }
        if campaign.status != CampaignStatus::Successful {
            panic!("Campaign must be successful to claim");
        }

        let amount = campaign.raised;
        campaign.raised = 0;
        campaign.status = CampaignStatus::Failed; // Prevent double-claim — mark as withdrawn

        env.storage()
            .persistent()
            .set(&DataKey::Campaign(campaign_id), &campaign);

        env.events().publish(
            (CAMPAIGN_CLAIMED, symbol_short!("claim")),
            (campaign_id, creator, amount),
        );
    }

    /// Cancel campaign (only creator, only if no contributions)
    pub fn cancel_campaign(env: Env, campaign_id: u64, creator: Address) {
        creator.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.creator != creator {
            panic!("Only creator can cancel");
        }
        if campaign.status != CampaignStatus::Active {
            panic!("Only active campaigns can be cancelled");
        }
        if campaign.raised > 0 {
            panic!("Cannot cancel: contributions exist, use refund process");
        }

        campaign.status = CampaignStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Campaign(campaign_id), &campaign);

        env.events().publish(
            (CAMPAIGN_CANCELLED, symbol_short!("cancel")),
            (campaign_id, creator),
        );
    }

    // ─── Read-only Views ─────────────────────────────────────────────────────

    pub fn get_campaign(env: Env, campaign_id: u64) -> Campaign {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found")
    }

    pub fn get_campaign_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&CAMPAIGN_COUNT)
            .unwrap_or(0)
    }

    pub fn get_contribution(env: Env, campaign_id: u64, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(campaign_id, contributor))
            .unwrap_or(0)
    }

    pub fn get_campaign_backers(env: Env, campaign_id: u64) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::CampaignBackers(campaign_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_backer_campaigns(env: Env, backer: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::BackerContributions(backer))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN)
            .expect("Not initialized")
    }

    /// Check and update campaign status (call periodically)
    pub fn update_status(env: Env, campaign_id: u64) -> CampaignStatus {
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        if campaign.status == CampaignStatus::Active
            && env.ledger().timestamp() > campaign.deadline
        {
            if campaign.raised >= campaign.goal {
                campaign.status = CampaignStatus::Successful;
            } else {
                campaign.status = CampaignStatus::Failed;
            }
            env.storage()
                .persistent()
                .set(&DataKey::Campaign(campaign_id), &campaign);
        }

        campaign.status
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env, String};

    #[test]
    fn test_create_campaign() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, CrowdfundingContract);
        let client = CrowdfundingContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);

        client.initialize(&admin);

        let id = client.create_campaign(
            &creator,
            &String::from_str(&env, "Test Campaign"),
            &String::from_str(&env, "A great project"),
            &10_000_000i128, // 1 XLM
            &86400u64,       // 1 day
        );
        assert_eq!(id, 1);

        let campaign = client.get_campaign(&1);
        assert_eq!(campaign.goal, 10_000_000);
        assert_eq!(campaign.raised, 0);
    }

    #[test]
    fn test_contribute() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, CrowdfundingContract);
        let client = CrowdfundingContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let backer = Address::generate(&env);

        client.initialize(&admin);
        let id = client.create_campaign(
            &creator,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Desc"),
            &100_000_000i128,
            &86400u64,
        );

        client.contribute(&id, &backer, &50_000_000i128);

        let campaign = client.get_campaign(&id);
        assert_eq!(campaign.raised, 50_000_000);
        assert_eq!(campaign.backer_count, 1);

        let contribution = client.get_contribution(&id, &backer);
        assert_eq!(contribution, 50_000_000);
    }
}
