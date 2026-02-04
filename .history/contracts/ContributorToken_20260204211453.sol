// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ContributorToken is ERC20, Ownable {

    constructor()
        ERC20("Contributor Token", "CTKN")
        Ownable(msg.sender)
    {}

    /* ========== MINT (Crowdfunding contract only) ========== */

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /* ========== BURN (Crowdfunding contract only) ========== */

    // Allow users to burn their own tokens (for NFT redemption)
    function burn(address from, uint256 amount) external {
        require(msg.sender == from || msg.sender == owner(), "Not allowed");
        _burn(from, amount);
    }
}
