// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IXGENKYC {
    function isKYCApproved(address account) external view returns (bool);
    function getIdentityHash(address account) external view returns (bytes32);
    function getKYCExpiry(address account) external view returns (uint256);
    function getVerificationLevel(address account) external view returns (string memory);
}
