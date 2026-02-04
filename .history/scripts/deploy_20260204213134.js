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

  /* ========== TRANSFER TOKEN OWNERSHIP ========== */

  const tx = await token.transferOwnership(crowdfundingAddress);
  await tx.wait();

  console.log("ContributorToken ownership transferred to Crowdfunding");

  // Log contract address at the end for clarity
  console.log("=== Crowdfunding contract address (use in frontend):", crowdfundingAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
