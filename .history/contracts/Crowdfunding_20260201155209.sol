// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IContributorToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

contract Crowdfunding {
    /* ========== TYPES ========== */

    enum CampaignState {
        Submitted,    // 0 - waiting for moderator
        Approved,     // 1 - approved, not started
        Active,       // 2 - fundraising active
        Successful,   // 3 - goal reached
        Failed,       // 4 - deadline passed, goal not reached
        Withdrawn,    // 5 - creator withdrew funds
        Rejected      // 6 - rejected by moderator
    }

    struct Campaign {
        address creator;
        string title;
        uint256 goal;
        uint256 deadline;
        uint256 raised;
        CampaignState state;
    }

    /* ========== STORAGE ========== */

    Campaign[] public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    address public moderator;
    IContributorToken public rewardToken;

    /* ========== MODIFIERS ========== */

    modifier onlyModerator() {
        require(msg.sender == moderator, "Not moderator");
        _;
    }

    modifier onlyCreator(uint256 id) {
        require(msg.sender == campaigns[id].creator, "Not creator");
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor(address _tokenAddress) {
        moderator = msg.sender;
        rewardToken = IContributorToken(_tokenAddress);
    }

    /* ========== VIEW FUNCTIONS (ABI MATCH) ========== */

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    function campaigns(uint256 id)
        external
        view
        returns (
            address,
            string memory,
            uint256,
            uint256,
            uint256,
            uint8
        )
    {
        Campaign storage c = campaigns[id];
        return (
            c.creator,
            c.title,
            c.goal,
            c.deadline,
            c.raised,
            uint8(c.state)
        );
    }

    /* ========== CREATOR ========== */

    function submitCampaign(
        string memory title,
        uint256 goal,
        uint256 duration
    ) external {
        require(goal > 0, "Goal must be > 0");
        require(duration > 0, "Duration must be > 0");

        campaigns.push(
            Campaign({
                creator: msg.sender,
                title: title,
                goal: goal,
                deadline: block.timestamp + duration,
                raised: 0,
                state: CampaignState.Submitted
            })
        );
    }

    function withdraw(uint256 id) external onlyCreator(id) {
        Campaign storage c = campaigns[id];
        require(c.state == CampaignState.Successful, "Not successful");

        c.state = CampaignState.Withdrawn;
        payable(c.creator).transfer(c.raised);
    }

    /* ========== MODERATOR ========== */

    function approveCampaign(uint256 id) external onlyModerator {
        Campaign storage c = campaigns[id];
        require(c.state == CampaignState.Submitted, "Not submitted");

        c.state = CampaignState.Active;
    }

    function rejectCampaign(uint256 id) external onlyModerator {
        Campaign storage c = campaigns[id];
        require(c.state == CampaignState.Submitted, "Not submitted");

        c.state = CampaignState.Rejected;
    }

    /* ========== CONTRIBUTOR ========== */

    function contribute(uint256 id) external payable {
        Campaign storage c = campaigns[id];
        require(c.state == CampaignState.Active, "Not active");
        require(block.timestamp < c.deadline, "Deadline passed");
        require(msg.value > 0, "Zero contribution");

        c.raised += msg.value;
        contributions[id][msg.sender] += msg.value;

        // Mint reward tokens 1:1 with wei (educational only)
        rewardToken.mint(msg.sender, msg.value);

        if (c.raised >= c.goal) {
            c.state = CampaignState.Successful;
        }
    }

    function finalize(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.state == CampaignState.Active, "Not active");
        require(block.timestamp >= c.deadline, "Too early");

        if (c.raised >= c.goal) {
            c.state = CampaignState.Successful;
        } else {
            c.state = CampaignState.Failed;
        }
    }

    function refund(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.state == CampaignState.Failed, "Refund not allowed");

        uint256 amount = contributions[id][msg.sender];
        require(amount > 0, "Nothing to refund");

        contributions[id][msg.sender] = 0;

        // Burn reward tokens
        rewardToken.burn(msg.sender, amount);

        payable(msg.sender).transfer(amount);
    }

    /* ========== RECEIVE ========== */

    receive() external payable {}
}
