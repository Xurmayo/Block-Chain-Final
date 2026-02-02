// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IContributorToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

contract Crowdfunding {
    /* ========== TYPES ========== */

    enum CampaignState {
        Submitted,    // 0
        Approved,     // 1 (kept for compatibility, not used)
        Active,       // 2
        Successful,   // 3
        Failed,       // 4
        Withdrawn,    // 5
        Rejected      // 6
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

    Campaign[] private _campaigns;   // 🔑 renamed
    mapping(uint256 => mapping(address => uint256)) public contributions;

    address public moderator;
    IContributorToken public rewardToken;

    /* ========== MODIFIERS ========== */

    modifier onlyModerator() {
        require(msg.sender == moderator, "Not moderator");
        _;
    }

    modifier onlyCreator(uint256 id) {
        require(msg.sender == _campaigns[id].creator, "Not creator");
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor(address tokenAddress) {
        moderator = msg.sender;
        rewardToken = IContributorToken(tokenAddress);
    }

    /* ========== VIEW FUNCTIONS (ABI MATCHES FRONTEND) ========== */

    function campaignCount() external view returns (uint256) {
        return _campaigns.length;
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
        Campaign storage c = _campaigns[id];
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

        _campaigns.push(
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
        Campaign storage c = _campaigns[id];
        require(c.state == CampaignState.Successful, "Not successful");

        c.state = CampaignState.Withdrawn;
        payable(c.creator).transfer(c.raised);
    }

    /* ========== MODERATOR ========== */

    function approveCampaign(uint256 id) external onlyModerator {
        Campaign storage c = _campaigns[id];
        require(c.state == CampaignState.Submitted, "Not submitted");

        c.state = CampaignState.Active;
    }

    function rejectCampaign(uint256 id) external onlyModerator {
        Campaign storage c = _campaigns[id];
        require(c.state == CampaignState.Submitted, "Not submitted");

        c.state = CampaignState.Rejected;
    }

    /* ========== CONTRIBUTOR ========== */

    function contribute(uint256 id) external payable {
        Campaign storage c = _campaigns[id];
        require(c.state == CampaignState.Active, "Not active");
        require(block.timestamp < c.deadline, "Deadline passed");
        require(msg.value > 0, "Zero contribution");

        c.raised += msg.value;
        contributions[id][msg.sender] += msg.value;

        // Educational token mint (1 wei = 1 token unit)
        rewardToken.mint(msg.sender, msg.value);

        if (c.raised >= c.goal) {
            c.state = CampaignState.Successful;
        }
    }

    function finalize(uint256 id) external {
        Campaign storage c = _campaigns[id];
        require(c.state == CampaignState.Active, "Not active");
        require(block.timestamp >= c.deadline, "Too early");

        if (c.raised >= c.goal) {
            c.state = CampaignState.Successful;
        } else {
            c.state = CampaignState.Failed;
        }
    }

    function refund(uint256 id) external {
        Campaign storage c = _campaigns[id];
        require(c.state == CampaignState.Failed, "Refund not allowed");

        uint256 amount = contributions[id][msg.sender];
        require(amount > 0, "Nothing to refund");

        contributions[id][msg.sender] = 0;

        rewardToken.burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }

    receive() external payable {}
}
