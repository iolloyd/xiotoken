// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IXGENVesting {
    function totalBeneficiaries() external view returns (uint256);
    function totalVested() external view returns (uint256);
    function totalClaimed() external view returns (uint256);
    function vestedAmount(address beneficiary) external view returns (uint256);
    function claimVested() external;
    function addBeneficiary(address beneficiary, uint256 allocation) external;
}