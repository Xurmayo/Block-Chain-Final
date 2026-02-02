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

    function contribute(uint256 campaignId) external payable {
        Campaign storage c = campaigns[campaignId];

        require(c.state == CampaignState.Active, "Not active");
        require(block.timestamp < c.deadline, "Deadline passed");
        require(msg.value > 0, "Zero contribution");

        contributions[campaignId][msg.sender] += msg.value;
        c.totalRaised += msg.value;

        // 1 wei = 1 CTKN (simple, exam-friendly)
        token.mint(msg.sender, msg.value);

        if (c.totalRaised >= c.goal) {
            c.state = CampaignState.Successful;
        }
    }
}
