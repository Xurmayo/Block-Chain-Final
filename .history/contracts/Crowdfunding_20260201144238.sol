// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RewardToken.sol";

contract Crowdfunding {
    struct Campaign {
        address creator;
        string title;
        uint256 goal;
        uint256 deadline;
        uint256 raised;
        bool finalized;
        bool successful;
    }

    RewardToken public rewardToken;
    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    event CampaignCreated(
        uint256 indexed id,
        address indexed creator,
        string title,
        uint256 goal,
        uint256 deadline
    );

    event Contributed(
        uint256 indexed id,
        address indexed contributor,
        uint256 amount
    );

    event CampaignSuccessful(uint256 indexed id);
    event CampaignFailed(uint256 indexed id);
    event FundsWithdrawn(uint256 indexed id, uint256 amount);
    event Refunded(uint256 indexed id, address indexed user, uint256 amount);

    constructor(address _tokenAddress) {
        rewardToken = RewardToken(_tokenAddress);
    }

    function createCampaign(
        string memory _title,
        uint256 _goal,
        uint256 _duration
    ) external {
        require(_goal > 0, "Goal must be > 0");
        require(_duration > 0, "Duration must be > 0");

        campaignCount++;

        campaigns[campaignCount] = Campaign({
            creator: msg.sender,
            title: _title,
            goal: _goal,
            deadline: block.timestamp + _duration,
            raised: 0,
            finalized: false,
            successful: false
        });

        emit CampaignCreated(
            campaignCount,
            msg.sender,
            _title,
            _goal,
            block.timestamp + _duration
        );
    }

    function contribute(uint256 _campaignId) external payable {
        Campaign storage campaign = campaigns[_campaignId];

        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(!campaign.finalized, "Finalized");
        require(msg.value > 0, "Send ETH");

        campaign.raised += msg.value;
        contributions[_campaignId][msg.sender] += msg.value;

        // 1 ETH = 100 CST
        uint256 rewardAmount = msg.value * 100;
        rewardToken.mint(msg.sender, rewardAmount);

        emit Contributed(_campaignId, msg.sender, msg.value);
    }

    function finalizeCampaign(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];

        require(block.timestamp >= campaign.deadline, "Still active");
        require(!campaign.finalized, "Already finalized");

        campaign.finalized = true;

        if (campaign.raised >= campaign.goal) {
            campaign.successful = true;
            emit CampaignSuccessful(_campaignId);
        } else {
            campaign.successful = false;
            emit CampaignFailed(_campaignId);
        }
    }

    function withdrawFunds(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];

        require(campaign.finalized, "Not finalized");
        require(campaign.successful, "Failed");
        require(msg.sender == campaign.creator, "Not creator");
        require(campaign.raised > 0, "No funds");

        uint256 amount = campaign.raised;
        campaign.raised = 0;

        payable(msg.sender).transfer(amount);

        emit FundsWithdrawn(_campaignId, amount);
    }

    function refund(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];

        require(campaign.finalized, "Not finalized");
        require(!campaign.successful, "Successful");

        uint256 contributed = contributions[_campaignId][msg.sender];
        require(contributed > 0, "Nothing to refund");

        contributions[_campaignId][msg.sender] = 0;
        payable(msg.sender).transfer(contributed);

        emit Refunded(_campaignId, msg.sender, contributed);
    }
}
