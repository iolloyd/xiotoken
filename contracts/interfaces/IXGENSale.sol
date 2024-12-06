// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IXGENSale {
    function totalParticipants() external view returns (uint256);
    function totalSold() external view returns (uint256);
    function largestPurchase() external view returns (uint256);
    function smallestPurchase() external view returns (uint256);
    function tokenPrice() external view returns (uint256);
    function endSale() external;
}