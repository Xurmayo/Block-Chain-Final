const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  /* ========== DEPLOY CONTRIBUTOR TOKEN ========== */

  const ContributorToken = await hre.ethers.getContractFactory("ContributorToken");
  const token = await ContributorToken.deploy();
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("ContributorToken deployed to:", tokenAddress);

  /* ========== DEPLOY CROWDFUNDING ========== */

  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy(tokenAddress);
  await crowdfunding.waitForDeployment();

  const crowdfundingAddress = await crowdfunding.getAddress();
  console.log("Crowdfunding deployed to:", crowdfundingAddress);

  /* ========== DEPLOY CONTRIBUTOR BADGE NFT ========== */

  const ContributorBadge = await hre.ethers.getContractFactory("ContributorBadge");
  const badge = await ContributorBadge.deploy();
  await badge.waitForDeployment();

  const badgeAddress = await badge.getAddress();
  console.log("ContributorBadge (NFT) deployed to:", badgeAddress);

  /* ========== TRANSFER TOKEN OWNERSHIP ========== */

  const tx = await token.transferOwnership(crowdfundingAddress);
  await tx.wait();

  console.log("ContributorToken ownership transferred to Crowdfunding");

  // Print NFT address in a format easy to copy for app.js
  console.log("\n=== Copy this NFT contract address to the top of your frontend/app.js ===");
  console.log(`const NFT_CONTRACT_ADDRESS = "${badgeAddress}";`);
  console.log("=======================================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
