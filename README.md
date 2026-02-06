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
- Campaign submission
- Contribution tracking
- Refund logic
- Campaign states
- Contributor history tracking

---

### 2️Contributor Token (ERC20)
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
styles.css

scripts/
deploy.js

```


---

## Installation & Setup

###  Clone Repository

```
git clone https://github.com/Xurmayo/Block-Chain-Final.git
cd Block-Chain-Final
npm install
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Open frontend/index.html using Live Server or browser.

### Wallet Setup

Install MetaMask

Connect to Hardhat local network

Import test accounts from Hardhat node(2 is enough for testing 1 should be root #0 and second one doesn't matter which)


### Educational Purpose

This project was developed to demonstrate:

Smart contract design

Web3 frontend integration

Token and NFT standards

Decentralized application architecture

### Authors

### Alisher Amangeldi & Nurzhan Nurlybek
### SE-2432
### Astana IT University

