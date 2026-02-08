#  Open Source Funding DApp

A decentralized crowdfunding platform built using **Solidity**, **Hardhat**, **Ethers.js**, and **Web3 frontend technologies**.  
The application allows creators to launch campaigns, contributors to fund them, moderators to approve campaigns, and contributors to earn NFT badges as rewards.

---

## Project Overview

This project demonstrates a full-stack Web3 decentralized application (DApp) that enables:

- Campaign creation and management
- Smart contract-based crowdfunding
- Token rewards for contributors
- NFT badge minting system
- Role-based access (Creator, Contributor, Moderator)
- Contributor tracking and transparency

---

##  Technologies Used

### Blockchain
- Solidity
- Hardhat
- Ethereum Local Network

### Frontend
- JavaScript
- HTML/CSS
- Ethers.js

### Token Standards
- ERC20 (Contributor Reward Token)
- ERC721 (NFT Badge System)

---

##  Application Architecture

The DApp has three layers:

1. **Smart contracts (blockchain)**  
   - **Crowdfunding.sol** – campaign lifecycle, contributions, finalization, refunds, moderator actions. Holds campaign state and uses the reward token for mint/burn.  
   - **ContributorToken.sol** – ERC-20 CTKN; only the Crowdfunding contract can mint; users can burn (e.g. for NFT trade).  
   - **ContributorBadge.sol** – ERC-721 NFTs; optional reward for contributors.

2. **Frontend (client)**  
   - Single-page app (HTML + JavaScript). Uses Ethers.js to create a provider (MetaMask), signer, and contract instances. No backend server; all reads/writes go to the blockchain.

3. **Interaction flow**  
   - User connects MetaMask → app checks chain ID (31337 / Sepolia / Holesky) → user picks role (Creator / Moderator / Contributor).  
   - Creator submits campaigns; Moderator approves or rejects; Contributors send ETH via `contribute()`.  
   - Contract mints CTKN on each contribution; on deadline, anyone can call `finalize()`; creator can `withdraw()` if successful, or contributors can `refund()` if failed.

---

##  Design and Implementation Decisions

- **Moderator role:** One address (deployer) approves/rejects campaigns so only vetted campaigns go live.  
- **Reward token ownership:** CTKN ownership is transferred to the Crowdfunding contract so only it can mint (on contribute) and users/contract can burn (refund, NFT trade).  
- **Campaign deadline:** Stored as a Unix timestamp set when a moderator approves (current time + duration).  
- **1:1 token mint:** One CTKN per wei contributed keeps the model simple and proportional.  
- **Refund and burn:** On failed campaigns, refund restores ETH and burns the same amount of CTKN to keep supply consistent.  
- **Frontend roles:** UI is role-based (Creator / Moderator / Contributor) for clarity; the same wallet can switch roles.

---

##  Frontend-to-Blockchain Interaction

- **Connection:** `ethers.BrowserProvider(window.ethereum)` and `provider.send("eth_requestAccounts", [])` to connect MetaMask.  
- **Network check:** `provider.getNetwork()` and `chainId` validation (31337, 11155111, 17000).  
- **Reading data:** View functions are called with `contract.campaignCount()`, `contract.campaigns(i)`, `contract.contributions(id, address)`, etc., using the same provider/signer.  
- **Writing (transactions):** State-changing calls use the signer: `contract.submitCampaign(...)`, `contract.contribute(id, { value })`, etc. User confirms each tx in MetaMask.  
- **Token/NFT:** Reward token address is read from `contract.rewardToken()`. NFT and ETH/CTKN balances are read via separate contract instances.  
- **Display:** Wallet address (truncated), ETH and CTKN balances, campaign list and countdown are updated from on-chain data; success/error feedback is shown via alerts after transactions.

---

##  Features

### 👨‍🎨 Creator
- Submit crowdfunding campaigns
- Withdraw funds after successful campaign

### 🛡️ Moderator
- Approve or reject campaigns
- Control campaign activation

### 💰 Contributor
- Contribute ETH to campaigns
- Receive reward tokens (CTKN)
- Trade tokens for NFT badges
- View contributor donation history

---

##  Smart Contracts

###  Crowdfunding Contract
Handles:
- Campaign submission (title, description, funding goal, duration in seconds)
- Contribution tracking per user and per campaign
- Refund logic for failed campaigns (with token burn)
- Campaign states (Submitted → Active → Successful/Failed → Withdrawn, or Rejected)
- Contributor history via `getCampaignContributors(id)` and `contributions(id, address)`
- Finalization when deadline is reached (`finalize(id)`)

---

###  Contributor Token (ERC20)
- Reward contributors based on donation amount
- Tokens can be burned to obtain NFTs

---

###  Contributor Badge NFT (ERC721)
- Mint NFT badges
- Represents contributor achievements

---

## Campaign States

| State | Description |
|----------|-------------|
| Submitted | Waiting moderator approval |
| Active | Campaign collecting funds |
| Successful | Funding goal reached |
| Failed | Goal not reached |
| Withdrawn | Funds claimed by creator |
| Rejected | Campaign rejected |

---

## Contributor Transparency Feature

The application allows users to:

- View all contributors to a campaign
- See wallet addresses
- View total donated amount per contributor

This improves transparency and trust in fundraising.

---

## NFT Reward System

Contributors can:

- Earn CTKN tokens from donations
- Burn tokens to mint NFT badges:
  - 🥇 Gold Badge
  - 🥈 Silver Badge
  - 🥉 Bronze Badge

---

## 📦 Project Structure

```
contracts/
  Crowdfunding.sol
  ContributorBadge.sol
  ContributorToken.sol
frontend/
  index.html
  app.js
scripts/
  deploy.js
test/
  crowdfunding.test.js
ASSIGNMENT_COMPLIANCE.md   # Final exam requirement checklist
```


---

## Installation & Setup

###  Clone Repository

```
git clone https://github.com/Xurmayo/Block-Chain-Final.git
cd Block-Chain-Final
npm install
npx hardhat node
```

In a **second terminal**:

```
npx hardhat run scripts/deploy.js --network localhost
```

**Important:** After any smart contract change (e.g. adding new fields or functions), you must **redeploy**: restart the node (to get a fresh chain) or run `deploy.js` again on a new node, then use the printed addresses in `frontend/app.js` if they differ.

### Open frontend/index.html using Live Server or browser.

### Wallet Setup

1. Install [MetaMask](https://metamask.io/).
2. **Local network:** Add Custom RPC (e.g. http://127.0.0.1:8545, chainId 31337). Import test accounts from Hardhat node (Account #0 is moderator).
3. **Testnet (Sepolia/Holesky):** Switch MetaMask to Sepolia or Holesky. Get free test ETH from a faucet (see below).

### Obtaining Test ETH

- **Local (Hardhat):** Run `npx hardhat node`; use the printed private keys to import accounts in MetaMask. These accounts are prefunded with test ETH.
- **Sepolia:** Use [Sepolia Faucet](https://sepoliafaucet.com/) or [Alchemy Sepolia Faucet](https://www.alchemy.com/faucets/ethereum-sepolia).
- **Holesky:** Use [Holesky Faucet](https://holesky-faucet.pk910.de/) or similar.

Only test networks and test tokens are used; mainnet and real cryptocurrency are not used.


### Educational Purpose

This project was developed to demonstrate:

- Smart contract design (Solidity, OpenZeppelin)
- Web3 frontend integration (Ethers.js, MetaMask)
- Token and NFT standards (ERC-20, ERC-721)
- Decentralized application architecture (testnet only, no mainnet)

---

## Submission Checklist (Final Examination)

- [ ] **GitHub:** Upload repository link with full code.
- [ ] **PDF:** Export this README and `ASSIGNMENT_COMPLIANCE.md` as a single PDF (technical documentation).
- [ ] **Presentation:** Prepare slides covering project overview, architecture, demo, and Q&A.
- [ ] **Per member:** Each team member must upload their submission as required by the course.

**Defence (40 points):** Presentation and answers to questions during the defence.

---

### Authors

**Alisher Amangeldi & Nurzhan Nurlybek**  
SE-2432  
Astana IT University

