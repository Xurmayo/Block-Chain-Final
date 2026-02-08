# Open Source Funding DApp

This is a decentralized crowdfunding platform we built using Solidity for the smart contracts, Hardhat for development and testing, Ethers.js for blockchain interactions, and some basic web tech for the frontend.  
It lets creators start campaigns, contributors fund them, moderators approve things, and backers get NFT badges as a thank-you.

## Project Overview

We put together this full-stack Web3 app to handle stuff like creating and managing campaigns, handling contributions through smart contracts, rewarding people with tokens, minting NFTs, and assigning roles like creator, contributor, or moderator. It also keeps track of who's contributing what, which adds some nice transparency.

One thing we learned early on was how tricky it can be to balance decentralization with a bit of control-like having a moderator to vet campaigns so not just anything goes live.

## Technologies Used

### Blockchain Side
- Solidity for writing the contracts
- Hardhat for local development and deployment
- Running on Ethereum test networks like local Hardhat, Sepolia, or Holesky

### Frontend
- Plain JavaScript
- HTML and CSS for the interface
- Ethers.js to connect everything to the blockchain

### Token Stuff
- ERC20 for the contributor reward tokens
- ERC721 for the NFT badges

## Application Architecture

The app breaks down into three main parts:

1. **Smart contracts on the blockchain**  
   - Crowdfunding.sol manages the whole campaign process: starting them, taking contributions, wrapping things up, and handling refunds. It also deals with minting and burning reward tokens.  
   - ContributorToken.sol is our ERC-20 token (CTKN). We made sure only the crowdfunding contract can mint them, but users can burn theirs if they want, like to swap for an NFT.  
   - ContributorBadge.sol handles the ERC-721 NFTs as optional rewards.

2. **Frontend client**  
   - It's a simple single-page app with HTML and JS. No server involved-everything talks directly to the blockchain via Ethers.js. You connect with MetaMask, get a provider and signer, and interact with the contracts from there.

3. **How it all flows**  
   - Users connect their wallet, the app checks if they're on the right network (like our local test chain or Sepolia), and then they pick a role.  
   - Creators submit campaign ideas, moderators approve or reject, contributors send ETH to active ones.  
   - The contract mints CTKN based on contributions. When the deadline hits, anyone can finalize it; creators withdraw if it succeeded, or contributors get refunds (and their tokens get burned) if it flopped.

## Design and Implementation Decisions

We went with a single moderator address (the one that deploys the contract) to approve campaigns-keeps things simple and prevents spam, but in a real-world version, we'd probably make it more decentralized.  
For the reward tokens, we transferred ownership to the crowdfunding contract so it controls minting on contributions, and burning happens on refunds or NFT trades.  
Campaign deadlines are set as Unix timestamps when approved (current time plus the requested duration in seconds).  
We kept the token minting straightforward: 1 CTKN per wei contributed, which makes rewards proportional without overcomplicating math.  
On refunds for failed campaigns, we burn the tokens to match the ETH going back, keeping the supply in check.  
The frontend uses role-based views to make it user-friendly-same wallet can switch between creator, moderator, or contributor modes, which was a nice touch we added after some testing.

One challenge was handling timestamps and deadlines accurately in Solidity; we had to double-check a lot with Hardhat's time manipulation in tests.

## How Accounts and Contracts Interact

To really understand what's going on, you need to know there are three types of accounts at play: the moderator, creators, and contributors. Each one talks to the contracts differently.

### The Moderator (Deployer)

The first account that runs the deploy script becomes the moderator automatically-the Crowdfunding constructor saves `msg.sender` as the moderator address. This is the only account that can call `approveCampaign()` and `rejectCampaign()`. If anyone else tries, the `onlyModerator` modifier reverts the transaction. In practice, when you spin up a local Hardhat node, Account #0 is the deployer and therefore the moderator.

Moderators also have a fuller view of the platform-rejected and withdrawn campaigns are hidden from creators and contributors to keep the UI clean, but the moderator can still see them.

### Creators

Any address can be a creator-there's no whitelist or registration. You just call `submitCampaign()` with your title, description, goal (in wei), and duration (in seconds). The contract stores your address as the campaign's creator. Later, only you can call `withdraw()` on that campaign because of the `onlyCreator` modifier, which checks `msg.sender` against the stored creator address.

### Contributors

Same deal-any address can contribute. When you call `contribute(campaignId)` and attach ETH, a few things happen in one transaction:
1. Your ETH gets added to the campaign's `raised` amount.
2. Your address and amount get tracked in the `contributions` mapping.
3. If it's your first time contributing to that campaign, your address gets pushed to `campaignContributors[id]` so we can list all contributors later.
4. The Crowdfunding contract calls `rewardToken.mint(msg.sender, msg.value)` to mint CTKN directly to your wallet.
5. If the total raised hits the goal, the campaign flips to Successful right there.

### Cross-Contract Communication

This part is probably the trickiest to wrap your head around. We have three separate contracts deployed, and they need to talk to each other:

- **Crowdfunding <-> ContributorToken**: During deployment, we first deploy the token, then deploy Crowdfunding with the token's address passed in. After that we call `token.transferOwnership(crowdfundingAddress)` so the Crowdfunding contract becomes the owner of the token. This matters because `mint()` on the token has an `onlyOwner` modifier-so only Crowdfunding can create new tokens. When someone contributes, Crowdfunding calls `rewardToken.mint()`. When someone gets a refund, it calls `rewardToken.burn()`. The token trusts these calls because they come from its owner.

- **Frontend <-> ContributorBadge**: The NFT badge contract is more standalone. The frontend handles the trading flow itself: it checks your CTKN balance, burns 10 tokens through the token contract, and then calls `mint()` on the badge contract separately. These are two separate transactions, not one atomic operation-we kept it simple since it's a learning project.

### Full Campaign Lifecycle (On-Chain)

Here's what actually happens for each transaction during a campaign's life:

1. **Creator calls `submitCampaign("My Project", "Cool idea", 1 ether, 86400)`**
   The contract creates a new Campaign struct, stores the caller as creator, sets state to Submitted, and pushes it to the `_campaigns` array. The deadline stays 0 at this point because the campaign hasn't been approved yet.

2. **Moderator calls `approveCampaign(0)`**
   The modifier checks that `msg.sender == moderator`. The function flips the state to Active and calculates the deadline as `block.timestamp + duration`. So if the duration was 86400 (one day), the campaign expires exactly 24 hours from this approval.

3. **Contributor calls `contribute(0)` with `{value: 0.5 ether}`**
   The function checks the campaign is Active and the deadline hasn't passed. It records the ETH, updates `raised`, and calls `rewardToken.mint(contributor, 0.5 ether)` which mints 500000000000000000 CTKN tokens. Since 0.5 < 1 (the goal), the campaign stays Active.

4. **Another contributor sends `{value: 0.7 ether}`**
   Same flow. Now raised = 1.2 ether which is >= the 1 ether goal, so the contract sets the state to Successful right in the same transaction.

5. **Creator calls `withdraw(0)`**
   The `onlyCreator` modifier checks the caller. The function requires state == Successful, then changes state to Withdrawn and transfers all 1.2 ether to the creator's address via `transfer()`.

**If the campaign fails instead** (doesn't hit the goal before the deadline):

4. **Anyone calls `finalize(0)` after the deadline**
   The function checks `block.timestamp >= deadline` and that the campaign is still Active. Since raised < goal, it sets the state to Failed.

5. **Original contributor calls `refund(0)`**
   Checks state == Failed, looks up how much the contributor deposited, zeros out their record (so they can't double-refund), burns their CTKN tokens via the token contract, and sends their ETH back.

## Frontend-to-Blockchain Interaction

Connection happens through Ethers.js with window.ethereum for MetaMask. We request accounts and check the chain ID to make sure it's one we support (31337 for local, 11155111 for Sepolia, 17000 for Holesky).  
For reading data, we call view functions like campaignCount(), campaigns(i), or contributions(id, address) directly.  
Transactions for writes-like submitCampaign() or contribute(id) with ETH value-go through the signer, and users confirm in their wallet.  
We pull the reward token address from the contract and create separate instances for token and NFT balances.  
The UI updates dynamically with stuff like truncated wallet addresses, balances, campaign lists, and countdowns pulled from the chain. We use alerts for tx feedback, which isn't fancy but gets the job done.

## Features

### Creator
- Submit new crowdfunding campaigns with details like title, description, goal, and duration
- Withdraw funds once a campaign succeeds

### Moderator
- Review and approve or reject submitted campaigns
- Basically, gatekeep which ones go active
- Can see rejected and withdrawn campaigns (hidden from other roles to keep the feed clean)

### Contributor
- Send ETH to support active campaigns
- Get CTKN reward tokens based on your donation
- Swap tokens for NFT badges
- Check your donation history across campaigns

We added the history view because it felt important for trust-seeing who else contributed and how much.

## Smart Contracts

### Crowdfunding Contract
This is the core one. It covers submitting campaigns (with title, desc, goal, duration), tracking contributions by user and campaign, refunds with token burns for failures, and states like Submitted, Active, Successful, Failed, Withdrawn, or Rejected.  
You can get lists of contributors for a campaign or check specific contributions. Finalize gets called after deadline to lock in success or failure.

### Contributor Token (ERC20)
Mints rewards proportional to donations. Tokens can be burned when trading for NFTs or on refunds.

### Contributor Badge NFT (ERC721)
Lets you mint badges as a fun achievement for contributing.

## Campaign States

| State | Description |
|----------|-------------|
| Submitted | Waiting for moderator approval |
| Active | Open for contributions |
| Successful | Hit the funding goal |
| Failed | Didn't reach the goal |
| Withdrawn | Creator took the funds |
| Rejected | Moderator said no |

## Contributor Transparency Feature

Users can see all contributors to a campaign, including their wallet addresses and total amounts donated. We think this builds more trust in the system, especially since everything's on-chain anyway.

## NFT Reward System

After donating and getting CTKN, you can burn some to mint badges like Gold, Silver, or Bronze. It was a cool way to add gamification, and we had fun designing the tiers during development.

## Project Structure

```
.
├── .gitignore
├── README.md
├── artifacts/                # Compiled contract artifacts and build info
│   ├── @openzeppelin/        # OpenZeppelin contract artifacts
│   ├── build-info/           # Build information JSON files
│   └── contracts/            # Project-specific contract artifacts
├── cache/                    # Hardhat cache files
│   └── solidity-files-cache.json
├── contracts/                # Solidity smart contracts
│   ├── ContributorBadge.sol
│   ├── ContributorToken.sol
│   └── Crowdfunding.sol
├── frontend/                 # Simple web frontend
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── hardhat.config.js         # Hardhat configuration
├── ignition/                 # Ignition deployment modules
│   └── modules/
│       └── Lock.js
├── package-lock.json
├── package.json              # Node.js dependencies
├── scripts/                  # Deployment scripts
│   └── deploy.js
└── test/                     # Test files
    └── crowdfunding.test.js
```

## Installation & Setup

### Clone the Repo

```
git clone https://github.com/Xurmayo/Block-Chain-Final.git
cd Block-Chain-Final
npm install
npx hardhat node
```

Then, in another terminal:

```
npx hardhat run scripts/deploy.js --network localhost
```

Heads up: If you tweak the contracts, you'll need to redeploy-restart the node for a clean slate or just run deploy.js again, and update any addresses in app.js if they change.

### Open the Frontend

Just open index.html in your browser, maybe with a live server extension for auto-reloads.

### Wallet Setup

1. Get MetaMask if you don't have it.
2. For local testing: Add a custom RPC like http://127.0.0.1:8545 with chainId 31337. Import accounts from the Hardhat node output (the first one's the moderator, preloaded with ETH).
3. For testnets: Switch to Sepolia or Holesky in MetaMask and grab free test ETH from faucets.

### Getting Test ETH

- Local: Those imported accounts come with fake ETH.
- Sepolia: Try sepoliafaucet.com or Alchemy's faucet.
- Holesky: holesky-faucet.pk910.de works.

We're only using test stuff here-no real money or mainnet.

## Educational Purpose

We built this as a way to learn about smart contract design with Solidity and OpenZeppelin, hooking up frontends with Ethers.js and MetaMask, and working with ERC-20 and ERC-721 tokens. It's all testnet-based, no mainnet deployment. It was a great project for understanding decentralized apps, though gas optimization was tougher than we expected.

## Authors

Alisher Amangeldi & Nurzhan Nurlybek  
SE-2432  
Astana IT University