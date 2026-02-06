const hre = require("hardhat");

async function main() {

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // ===== Deploy ContributorToken =====
  const ContributorToken = await hre.ethers.getContractFactory("ContributorToken");
  const token = await ContributorToken.deploy();
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("ContributorToken deployed to:", tokenAddress);

  // ===== Deploy Crowdfunding =====
  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy(tokenAddress);
  await crowdfunding.waitForDeployment();

  const crowdfundingAddress = await crowdfunding.getAddress();
  console.log("Crowdfunding deployed to:", crowdfundingAddress);

  // ===== Transfer ownership =====
  const tx = await token.transferOwnership(crowdfundingAddress);
  await tx.wait();

  console.log("ContributorToken ownership transferred to Crowdfunding");

  // ===== Deploy NFT (ContributorBadge) =====
  const Badge = await hre.ethers.getContractFactory("ContributorBadge");
  const badge = await Badge.deploy();
  await badge.waitForDeployment();

  console.log("ContributorBadge deployed to:", await badge.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
