const hre = require("hardhat");

async function main() {
  const Token = await hre.ethers.getContractFactory("ContributorToken");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy(await token.getAddress());
  await crowdfunding.waitForDeployment();

  // Transfer token ownership to crowdfunding contract
  await token.transferOwnership(await crowdfunding.getAddress());

  console.log("Token:", await token.getAddress());
  console.log("Crowdfunding:", await crowdfunding.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
