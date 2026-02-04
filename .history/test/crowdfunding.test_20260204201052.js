const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Crowdfunding basic flows", function () {
  let deployer, creator, contributor, Token, Crowdfund;
  let token, crowdfunding;

  beforeEach(async () => {
    [deployer, creator, contributor] = await ethers.getSigners();

    Token = await ethers.getContractFactory("ContributorToken", deployer);
    token = await Token.deploy();
    await token.deployed();

    Crowdfund = await ethers.getContractFactory("Crowdfunding", deployer);
    crowdfunding = await Crowdfund.deploy(token.address);
    await crowdfunding.deployed();

    // transfer token ownership to crowdfunding so it can mint/burn
    await token.transferOwnership(crowdfunding.address);
  });

  it("allows submit -> approve -> contribute and mints tokens", async () => {
    // creator submits
    await crowdfunding.connect(creator).submitCampaign("T1", ethers.parseEther("1"), 1000);

    // moderator approves (deployer is moderator)
    await crowdfunding.connect(deployer).approveCampaign(0);

    // contributor contributes 1 ETH
    await crowdfunding.connect(contributor).contribute(0, { value: ethers.parseEther("1") });

    // token was minted to contributor
    const bal = await token.balanceOf(contributor.address);
    expect(bal).to.equal(ethers.parseEther("1"));

    // campaign should be successful (raised >= goal)
    const c = await crowdfunding.campaigns(0);
    expect(Number(c[4])).to.equal(Number(ethers.parseEther("1"))); // raised
    expect(Number(c[5])).to.equal(3); // Successful state index
  });

  it("finalizes failed campaign and allows refund with token burn", async () => {
    // submit a campaign with higher goal so it's going to fail
    await crowdfunding.connect(creator).submitCampaign("T2", ethers.parseEther("5"), 2);
    await crowdfunding.connect(deployer).approveCampaign(1);
    // contributor contributes less than goal
    await crowdfunding.connect(contributor).contribute(1, { value: ethers.parseEther("1") });
    // advance time beyond deadline
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);
    // finalize -> should mark Failed
    await crowdfunding.connect(deployer).finalize(1);
    const c = await crowdfunding.campaigns(1);
    expect(Number(c[5])).to.equal(4); // Failed state index

    // balance before refund
    const beforeEth = await ethers.provider.getBalance(contributor.address);
    const tokenBalBefore = await token.balanceOf(contributor.address);
    expect(tokenBalBefore).to.equal(ethers.parseEther("1"));

    // refund (contributor)
    const tx = await crowdfunding.connect(contributor).refund(1);
    await tx.wait();

    // token balance burned
    const tokenBalAfter = await token.balanceOf(contributor.address);
    expect(tokenBalAfter).to.equal(0);
  });
});
