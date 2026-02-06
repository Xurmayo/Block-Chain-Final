// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ContributorBadge is ERC721Enumerable, Ownable {

    uint256 public nextTokenId;

    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("Contributor Badge", "CBADGE") Ownable(msg.sender) {}

    function mint(address to, string memory uri)
        external
        returns (uint256)
    {
        uint256 tokenId = nextTokenId++;

        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = uri;

        return tokenId;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        return _tokenURIs[tokenId];
    }
}
