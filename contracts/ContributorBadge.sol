// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ContributorBadge is ERC721URIStorage, Ownable {
    uint256 public nextTokenId;

    constructor() ERC721("Contributor Badge", "CBADGE") Ownable(msg.sender) {}

    // REMOVE onlyOwner for demo/testing
    function mint(address to, string memory uri) external returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }
}
