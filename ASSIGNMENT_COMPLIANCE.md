# Final Examination Project — Assignment Compliance

**Course:** Blockchain 1 · **Format:** Group Project  
**Technology Stack:** Solidity, JavaScript, MetaMask, Ethereum (Testnet)

---

## 1. PURPOSE OF THE FINAL PROJECT ✅

The project comprehensively assesses:
- **Smart contract design and implementation** using Solidity (Crowdfunding, ERC-20, ERC-721).
- **Client-side blockchain interaction** using JavaScript and Ethers.js.
- **MetaMask integration** for wallet connection and transaction signing.
- **Ethereum test network** usage (local Hardhat and/or Sepolia/Holesky).
- **DApp architecture**: separation of contracts, tokenization, and frontend.

---

## 2. PROJECT OVERVIEW ✅

Decentralized crowdfunding application that:
- Operates **exclusively on Ethereum test network** (Hardhat local, Sepolia, or Holesky).
- Uses **free test tokens only** (test ETH from faucets / Hardhat accounts).
- Enables:
  - **Creation of crowdfunding campaigns** (title, goal, duration).
  - **Participation as contributors** (contribute test ETH).
  - **Issuance of internal reward tokens (CTKN)** for contributions.
  - **Secure interaction** via MetaMask (no mainnet, no real crypto).

---

## 3. FUNCTIONAL SYSTEM REQUIREMENTS ✅

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Operate on test network only | ✅ | Hardhat local (31337), optional Sepolia/Holesky in config |
| MetaMask integration | ✅ | `eth_requestAccounts`, network validation, tx via signer |
| Free test ETH and test tokens only | ✅ | Local: Hardhat accounts; Testnet: faucets |
| Real blockchain interaction | ✅ | All actions are on-chain transactions |
| **Smart contracts:** | | |
| Campaign creation (title, description, goal, duration/deadline) | ✅ | `submitCampaign(title, description, goal, duration)`; deadline set on approve |
| Contribution of test ETH | ✅ | `contribute(id)` payable |
| Accurate tracking of contributions | ✅ | `contributions(campaignId, address)`, `getCampaignContributors(id)` |
| Finalization upon deadline | ✅ | `finalize(id)` after deadline |
| Issuance of reward tokens proportional to contributions | ✅ | 1:1 mint of CTKN on each contribution |
| **ERC-20 token:** | | |
| Minted automatically during participation | ✅ | Crowdfunding contract mints CTKN on `contribute()` |
| No real monetary value / educational only | ✅ | CTKN is internal reward token |
| **Frontend:** | | |
| Connect to MetaMask | ✅ | `ethers.BrowserProvider(window.ethereum)` |
| Display connected wallet address | ✅ | Header shows truncated address + blockies avatar |
| Verify selected blockchain network | ✅ | ChainId check (31337 or testnet) |
| Create campaigns, contribute, monitor outcomes | ✅ | Role-based UI and campaign grid |
| Display test ETH and reward token balances | ✅ | Header: ETH and CTKN balances |

---

## 4. METAMASK INTEGRATION REQUIREMENTS ✅

- **Request permission to access accounts:** `provider.send("eth_requestAccounts", [])`.
- **Validation of active test network:** Check `network.chainId` (31337 for local, 11155111 Sepolia, 17000 Holesky).
- **Execution of transactions through MetaMask:** All `contract.*` calls use `signer` from `provider.getSigner()`.

---

## 5. PROJECT DOCUMENTATION REQUIREMENTS ✅

- **Application architecture:** README + this document (contracts, frontend, data flow).
- **Design and implementation decisions:** README (campaign states, token flow, moderator role).
- **Smart contract logic:** README “Smart Contracts” and in-code comments.
- **Frontend-to-blockchain interaction:** README + comments in `app.js` (provider, signer, contract calls).
- **Deployment and execution instructions:** README “Installation & Setup”.
- **Obtaining test ETH:** README section for local (Hardhat accounts) and testnet (faucet links).

---

## 6. ACADEMIC AND TECHNICAL CONSTRAINTS ✅

- **No mainnet deployment:** Config and README specify testnet/local only.
- **No real cryptocurrency:** Test ETH and CTKN only.
- **Group project:** Completed by group (per assignment “Format: Group Project”).
- **No plagiarism:** Original implementation; references (e.g. OpenZeppelin) cited.

---

## Evaluation Criteria Mapping (60 pts)

| Criterion | Points | Evidence |
|-----------|--------|----------|
| Smart contract implementation | 24 | Crowdfunding.sol, ContributorToken.sol, ContributorBadge.sol |
| Correct crowdfunding logic | 6 | Submit → Approve → Contribute → Finalize/Refund/Withdraw |
| ERC-20 token usage | 6 | CTKN mint on contribute, burn on refund/NFT trade |
| MetaMask integration | 6 | Connect, network check, all txs via MetaMask |
| Test network usage | 6 | Hardhat local + optional Sepolia/Holesky |
| Quality of documentation | 6 | README, ASSIGNMENT_COMPLIANCE.md, code comments |
| Architecture and code structure | 6 | contracts/, frontend/, scripts/, test/ |

**Defence:** 40 points (presentation and Q&A).

---

## Quick requirements checklist

| # | Requirement | ✓ |
|---|-------------|---|
| 1 | Free topic (crowdfunding) | ✅ |
| 2 | Solidity smart contracts | ✅ |
| 3 | JavaScript client + MetaMask | ✅ |
| 4 | Ethereum testnet only (no mainnet) | ✅ |
| 5 | Campaign creation (title, description, goal, duration) | ✅ |
| 6 | Users contribute test ETH | ✅ |
| 7 | Internal reward token (ERC-20) minted on participation | ✅ |
| 8 | Accurate contribution tracking | ✅ |
| 9 | Finalization upon deadline | ✅ |
| 10 | Frontend: connect MetaMask, show address, verify network | ✅ |
| 11 | Frontend: create campaigns, contribute, monitor outcomes | ✅ |
| 12 | Frontend: display ETH and reward token balances | ✅ |
| 13 | MetaMask: request accounts, validate network, execute txs | ✅ |
| 14 | Documentation: architecture, design, contract logic, frontend-blockchain, deployment, test ETH | ✅ |
| 15 | No real cryptocurrency | ✅ |
| 16 | Tests: `npm test` runs Hardhat tests | ✅ |
