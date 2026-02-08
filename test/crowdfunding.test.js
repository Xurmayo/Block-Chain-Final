const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Crowdfunding basic flows", function () {
  let deployer, creator, contributor, other, Token, Crowdfund;
  let token, crowdfunding;

  beforeEach(async () => {
    [deployer, creator, contributor, other] = await ethers.getSigners();

    Token = await ethers.getContractFactory("ContributorToken", deployer);
    token = await Token.deploy();
    await token.waitForDeployment();

    const tokenAddress = await token.getAddress();
    Crowdfund = await ethers.getContractFactory("Crowdfunding", deployer);
    crowdfunding = await Crowdfund.deploy(tokenAddress);
    await crowdfunding.waitForDeployment();

    await token.transferOwnership(await crowdfunding.getAddress());
  });

  it("allows submit -> approve -> contribute and mints tokens", async () => {
    await crowdfunding
      .connect(creator)
      .submitCampaign("T1", "", ethers.parseEther("1"), 1000);
    await crowdfunding.connect(deployer).approveCampaign(0);
    await crowdfunding
      .connect(contributor)
      .contribute(0, { value: ethers.parseEther("1") });

    const bal = await token.balanceOf(contributor.address);
    expect(bal).to.equal(ethers.parseEther("1"));

    const c = await crowdfunding.campaigns(0);
    expect(Number(c[5])).to.equal(Number(ethers.parseEther("1"))); // raised
    expect(Number(c[6])).to.equal(3); // Successful
  });

  it("finalizes failed campaign and allows refund with token burn", async () => {
    await crowdfunding
      .connect(creator)
      .submitCampaign("T2", "", ethers.parseEther("5"), 2);
    await crowdfunding.connect(deployer).approveCampaign(1);
    await crowdfunding
      .connect(contributor)
      .contribute(1, { value: ethers.parseEther("1") });
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);
    await crowdfunding.connect(deployer).finalize(1);

    const c = await crowdfunding.campaigns(1);
    expect(Number(c[6])).to.equal(4); // Failed

    const tokenBalBefore = await token.balanceOf(contributor.address);
    expect(tokenBalBefore).to.equal(ethers.parseEther("1"));

    await crowdfunding.connect(contributor).refund(1);
    const tokenBalAfter = await token.balanceOf(contributor.address);
    expect(tokenBalAfter).to.equal(0);
  });

  it("rejects submitCampaign with zero goal", async () => {
    await expect(
      crowdfunding.connect(creator).submitCampaign("Bad", "", 0, 100),
    ).to.be.revertedWith("Goal must be > 0");
  });

  it("rejects submitCampaign with zero duration", async () => {
    await expect(
      crowdfunding
        .connect(creator)
        .submitCampaign("Bad", "", ethers.parseEther("1"), 0),
    ).to.be.reverted;
  });

  it("only moderator can approve campaign", async () => {
    await crowdfunding
      .connect(creator)
      .submitCampaign("T3", "", ethers.parseEther("1"), 100);
    await expect(
      crowdfunding.connect(contributor).approveCampaign(0),
    ).to.be.revertedWith("Not moderator");
    await crowdfunding.connect(deployer).approveCampaign(0);
    const c = await crowdfunding.campaigns(0);
    expect(Number(c[6])).to.equal(2); // Active
  });

  it("only moderator can reject campaign", async () => {
    await crowdfunding
      .connect(creator)
      .submitCampaign("T4", "", ethers.parseEther("1"), 100);
    await expect(
      crowdfunding.connect(contributor).rejectCampaign(0),
    ).to.be.revertedWith("Not moderator");
    await crowdfunding.connect(deployer).rejectCampaign(0);
    const c = await crowdfunding.campaigns(0);
    expect(Number(c[6])).to.equal(6); // Rejected
  });

  it("only creator can withdraw from successful campaign", async () => {
    await crowdfunding
      .connect(creator)
      .submitCampaign("T5", "", ethers.parseEther("1"), 1000);
    await crowdfunding.connect(deployer).approveCampaign(0);
    await crowdfunding
      .connect(contributor)
      .contribute(0, { value: ethers.parseEther("1") });
    await expect(
      crowdfunding.connect(contributor).withdraw(0),
    ).to.be.revertedWith("Not creator");
    await crowdfunding.connect(creator).withdraw(0);
    const c = await crowdfunding.campaigns(0);
    expect(Number(c[6])).to.equal(5); // Withdrawn
  });

  it("tracks campaign contributors and contribution amounts", async () => {
    await crowdfunding
      .connect(creator)
      .submitCampaign("T6", "", ethers.parseEther("10"), 1000);
    await crowdfunding.connect(deployer).approveCampaign(0);
    await crowdfunding
      .connect(contributor)
      .contribute(0, { value: ethers.parseEther("2") });
    await crowdfunding
      .connect(other)
      .contribute(0, { value: ethers.parseEther("3") });

    const contributors = await crowdfunding.getCampaignContributors(0);
    expect(contributors.length).to.equal(2);
    expect(contributors).to.include(contributor.address);
    expect(contributors).to.include(other.address);

    const amt1 = await crowdfunding.contributions(0, contributor.address);
    const amt2 = await crowdfunding.contributions(0, other.address);
    expect(amt1).to.equal(ethers.parseEther("2"));
    expect(amt2).to.equal(ethers.parseEther("3"));
  });

  it("contribute requires active campaign and reverts for rejected", async () => {
    await crowdfunding
      .connect(creator)
      .submitCampaign("T7", "", ethers.parseEther("1"), 100);
    await crowdfunding.connect(deployer).rejectCampaign(0);
    await expect(
      crowdfunding
        .connect(contributor)
        .contribute(0, { value: ethers.parseEther("0.5") }),
    ).to.be.revertedWith("Not active");
  });

  it("refund reverts when campaign is not failed", async () => {
    await crowdfunding
      .connect(creator)
      .submitCampaign("T8", "", ethers.parseEther("5"), 2);
    await crowdfunding.connect(deployer).approveCampaign(0);
    await crowdfunding
      .connect(contributor)
      .contribute(0, { value: ethers.parseEther("1") });
    await expect(
      crowdfunding.connect(contributor).refund(0),
    ).to.be.revertedWith("Refund not allowed");
  });

  it("campaignCount returns correct number of campaigns", async () => {
    expect(await crowdfunding.campaignCount()).to.equal(0);
    await crowdfunding
      .connect(creator)
      .submitCampaign("A", "", ethers.parseEther("1"), 100);
    expect(await crowdfunding.campaignCount()).to.equal(1);
    await crowdfunding
      .connect(creator)
      .submitCampaign("B", "", ethers.parseEther("1"), 100);
    expect(await crowdfunding.campaignCount()).to.equal(2);
  });
});
