// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RewardToken is ERC20 {
    address public crowdfundingContract;

    constructor() ERC20("ContributorToken", "CST") {}

    function setCrowdfunding(address _crowdfunding) external {
        require(crowdfundingContract == address(0), "Already set");
        crowdfundingContract = _crowdfunding;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == crowdfundingContract, "Not authorized");
        _mint(to, amount);
    }
}
