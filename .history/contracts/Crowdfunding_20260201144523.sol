// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ContributorToken.sol";

contract Crowdfunding {

    enum CampaignState {
        Active,
        Successful,
        Failed,
        Withdrawn
    }

    struct Campaign {
        address creator;
        string title;
        uint256 goal;
        uint256 deadline;
        uint256 totalRaised;
        CampaignState state;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    ContributorToken public token;

    constructor(address tokenAddress) {
        token = ContributorToken(tokenAddress);
    }

    /* ---------------- MODIFIERS ---------------- */

    modifier campaignExists(uint256 campaignId) {
        require(campaignId < campaignCount, "Campaign does not exist");
        _;
    }

    modifier onlyCreator(uint256 campaignId) {
        require(msg.sender == campaigns[campaignId].creator, "Not creator");
        _;
    }

    /* ---------------- CORE FUNCTIONS ---------------- */

    function createCampaign(
        string memory _title,
        uint256 _goal,
        uint256 _duration
    ) external {
        require(_goal > 0, "Goal must be > 0");

        campaigns[campaignCount] = Campaign({
            creator: msg.sender,
            title: _title,
            goal: _goal,
            deadline: block.timestamp + _duration,
            totalRaised: 0,
            state: CampaignState.Active
        });

        campaignCount++;
    }

    function contribute(uint256 campaignId)
        external
        payable
        campaignExists(campaignId)
    {
        Campaign storage c = campaigns[campaignId];

        require(c.state == CampaignState.Active, "Not active");
        require(block.timestamp < c.deadline, "Deadline passed");
        require(msg.value > 0, "Zero contribution");

        contributions[campaignId][msg.sender] += msg.value;
        c.totalRaised += msg.value;

        // 1 wei = 1 CTKN
        token.mint(msg.sender, msg.value);

        if (c.totalRaised >= c.goal) {
            c.state = CampaignState.Successful;
        }
    }

    /* ---------------- FINALIZATION ---------------- */

    function finalizeCampaign(uint256 campaignId)
        external
        campaignExists(campaignId)
    {
        Campaign storage c = campaigns[campaignId];

        require(c.state == CampaignState.Active, "Already finalized");
        require(block.timestamp >= c.deadline, "Too early");

        if (c.totalRaised >= c.goal) {
            c.state = CampaignState.Successful;
        } else {
            c.state = CampaignState.Failed;
        }
    }

    /* ---------------- WITHDRAW ---------------- */

    function withdrawFunds(uint256 campaignId)
        external
        campaignExists(campaignId)
        onlyCreator(campaignId)
    {
        Campaign storage c = campaigns[campaignId];

        require(c.state == CampaignState.Successful, "Not successful");

        c.state = CampaignState.Withdrawn;

        (bool sent, ) = payable(c.creator).call{value: c.totalRaised}("");
        require(sent, "ETH transfer failed");
    }

    /* ---------------- REFUND ---------------- */

    function refund(uint256 campaignId)
        external
        campaignExists(campaignId)
    {
        Campaign storage c = campaigns[campaignId];

        require(c.state == CampaignState.Failed, "Refund not allowed");

        uint256 amount = contributions[campaignId][msg.sender];
        require(amount > 0, "No contribution");

        contributions[campaignId][msg.sender] = 0;

        // Burn contributor tokens
        token.burn(msg.sender, amount);

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Refund failed");
    }
}
