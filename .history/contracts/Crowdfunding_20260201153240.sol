// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ContributorToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Crowdfunding is Ownable {

    enum State {
        Submitted,
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
        uint256 raised;
        State state;
    }

    ContributorToken public token;
    Campaign[] public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    constructor(address tokenAddress) Ownable(msg.sender) {
        token = ContributorToken(tokenAddress);
    }

    /* CREATOR */
    function submitCampaign(string memory title, uint256 goal, uint256 duration) external {
        campaigns.push(
            Campaign(
                msg.sender,
                title,
                goal,
                block.timestamp + duration,
                0,
                State.Submitted
            )
        );
    }

    /* MODERATOR */
    function approveCampaign(uint256 id) external onlyOwner {
        require(campaigns[id].state == State.Submitted);
        campaigns[id].state = State.Active;
    }

    function rejectCampaign(uint256 id) external onlyOwner {
        require(campaigns[id].state == State.Submitted);
        campaigns[id].state = State.Rejected;
    }

    /* CONTRIBUTOR */
    function contribute(uint256 id) external payable {
        Campaign storage c = campaigns[id];
        require(c.state == State.Active);
        require(block.timestamp < c.deadline);
        require(msg.value > 0);

        contributions[id][msg.sender] += msg.value;
        c.raised += msg.value;

        token.mint(msg.sender, msg.value);

        if (c.raised >= c.goal) {
            c.state = State.Successful;
        }
    }

    /* FINALIZE */
    function finalize(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.state == State.Active);
        require(block.timestamp >= c.deadline);

        c.state = c.raised >= c.goal ? State.Successful : State.Failed;
    }

    /* WITHDRAW */
    function withdraw(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(msg.sender == c.creator);
        require(c.state == State.Successful);

        c.state = State.Withdrawn;
        payable(c.creator).transfer(c.raised);
    }

    /* REFUND */
    function refund(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.state == State.Failed);

        uint256 amount = contributions[id][msg.sender];
        require(amount > 0);

        contributions[id][msg.sender] = 0;
        token.burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }
}
