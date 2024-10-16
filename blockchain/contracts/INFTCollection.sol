// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface INFTCollection is IERC721 {
    function mint(address customer) external returns (uint);

    function burn(uint tokenId) external;

    function setBaseUri(string calldata newUri) external;

    function getLastTokenId() external view returns (uint);

    function setAuthorizedContract(address newAuthorizedContract) external;
}
