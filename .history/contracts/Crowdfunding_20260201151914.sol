// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ContributorToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Crowdfunding is Ownable {

    enum CampaignState {
        Submitted,
        Approved,
        Active,
        Successful,
        Failed,
        Withdrawn,
        Rejected
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

    constructor(address tokenAddress) Ownable(msg.sender) {
        token = ContributorToken(tokenAddress);
    }

    /* ---------- CREATOR ---------- */

    function submitCampaign(
        string memory title,
        uint256 goal,
        uint256 duration
    ) external {
        require(goal > 0, "Invalid goal");

        campaigns[campaignCount] = Campaign({
            creator: msg.sender,
            title: title,
            goal: goal,
            deadline: block.timestamp + duration,
            totalRaised: 0,
            state: CampaignState.Submitted
        });

        campaignCount++;
    }

    /* ---------- MODERATOR ---------- */

    function approveCampaign(uint256 id) external onlyOwner {
        Campaign storage c = campaigns[id];
        require(c.state == CampaignState.Submitted, "Not submitted");
        c.state = CampaignState.Active;
    }

    function rejectCampaign(uint256 id) external onlyOwner {
        Campaign storage c = campaigns[id];
        require(c.state == CampaignState.Submitted, "Not submitted");
        c.state = CampaignState.Rejected;
    }

    /* ---------- CONTRIBUTOR ---------- */

    function contribute(uint256 id) external payable {
        Campaign storage c = campaigns[id];

        require(c.state == CampaignState.Active, "Not active");
        require(block.timestamp < c.deadline, "Deadline passed");
        require(msg.value > 0, "Zero ETH");

        contributions[id][msg.sender] += msg.value;
        c.totalRaised += msg.value;

        token.mint(msg.sender, msg.value);

        if (c.totalRaised >= c.goal) {
            c.state = CampaignState.Successful;
        }
    }

    /* ---------- FINALIZATION ---------- */

    function finalize(uint256 id) external {
        Campaign storage c = campaigns[id];

        require(c.state == CampaignState.Active, "Not active");
        require(block.timestamp >= c.deadline, "Too early");

        if (c.totalRaised >= c.goal) {
            c.state = CampaignState.Successful;
        } else {
            c.state = CampaignState.Failed;
        }
    }

    /* ---------- WITHDRAW ---------- */

    function withdraw(uint256 id) external {
        Campaign storage c = campaigns[id];

        require(msg.sender == c.creator, "Not creator");
        require(c.state == CampaignState.Successful, "Not successful");

        c.state = CampaignState.Withdrawn;

        (bool ok,) = payable(c.creator).call{value: c.totalRaised}("");
        require(ok, "Transfer failed");
    }

    /* ---------- REFUND ---------- */

    function refund(uint256 id) external {
        Campaign storage c = campaigns[id];

        require(c.state == CampaignState.Failed, "Refund not allowed");

        uint256 amount = contributions[id][msg.sender];
        require(amount > 0, "Nothing to refund");

        contributions[id][msg.sender] = 0;
        token.burn(msg.sender, amount);

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund failed");
    }
}
