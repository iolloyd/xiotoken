// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title XGENKYC
 * @notice Manages KYC verification for XGEN token sale participants
 */
contract XGENKYC is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    
    struct KYCData {
        bool verified;
        uint256 verificationDate;
        uint256 expiryDate;
        string verificationLevel;
        address verifier;
    }
    
    struct VerificationRequest {
        address applicant;
        string documentHash;
        uint256 timestamp;
        bool processed;
        bool approved;
    }
    
    // KYC status mapping
    mapping(address => KYCData) public kycStatus;
    
    // Verification request mapping
    mapping(bytes32 => VerificationRequest) public verificationRequests;
    mapping(address => bytes32[]) public userRequests;
    
    // Geographical restrictions
    mapping(string => bool) public restrictedRegions;
    
    // Events
    event KYCRequestSubmitted(bytes32 indexed requestId, address indexed applicant);
    event KYCVerified(address indexed account, string level, uint256 expiryDate);
    event KYCRevoked(address indexed account, string reason);
    event RegionRestrictionUpdated(string region, bool restricted);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }
    
    /**
     * @dev Submits a KYC verification request
     * @param documentHash Hash of the submitted KYC documents
     */
    function submitKYCRequest(string calldata documentHash) 
        external
        whenNotPaused
        nonReentrant
        returns (bytes32)
    {
        require(bytes(documentHash).length > 0, "XGENKYC: Empty document hash");
        require(!kycStatus[msg.sender].verified, "XGENKYC: Already verified");
        
        bytes32 requestId = keccak256(abi.encodePacked(
            msg.sender,
            documentHash,
            block.timestamp
        ));
        
        verificationRequests[requestId] = VerificationRequest({
            applicant: msg.sender,
            documentHash: documentHash,
            timestamp: block.timestamp,
            processed: false,
            approved: false
        });
        
        userRequests[msg.sender].push(requestId);
        
        emit KYCRequestSubmitted(requestId, msg.sender);
        return requestId;
    }
    
    /**
     * @dev Approves a KYC verification request
     * @param requestId ID of the verification request
     * @param level Verification level assigned
     * @param validityPeriod Period for which the verification is valid
     */
    function approveKYC(
        bytes32 requestId,
        string calldata level,
        uint256 validityPeriod
    )
        external
        onlyRole(VERIFIER_ROLE)
        nonReentrant
    {
        VerificationRequest storage request = verificationRequests[requestId];
        require(!request.processed, "XGENKYC: Already processed");
        require(request.applicant != address(0), "XGENKYC: Invalid request");
        
        request.processed = true;
        request.approved = true;
        
        uint256 expiryDate = block.timestamp + validityPeriod;
        
        kycStatus[request.applicant] = KYCData({
            verified: true,
            verificationDate: block.timestamp,
            expiryDate: expiryDate,
            verificationLevel: level,
            verifier: msg.sender
        });
        
        emit KYCVerified(request.applicant, level, expiryDate);
    }
    
    /**
     * @dev Revokes KYC verification
     * @param account Address whose KYC needs to be revoked
     * @param reason Reason for revocation
     */
    function revokeKYC(address account, string calldata reason)
        external
        onlyRole(VERIFIER_ROLE)
    {
        require(kycStatus[account].verified, "XGENKYC: Not verified");
        
        delete kycStatus[account];
        emit KYCRevoked(account, reason);
    }
    
    /**
     * @dev Updates geographical restrictions
     * @param region Region code
     * @param restricted Whether the region is restricted
     */
    function updateRegionRestriction(string calldata region, bool restricted)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        restrictedRegions[region] = restricted;
        emit RegionRestrictionUpdated(region, restricted);
    }
    
    /**
     * @dev Checks if an address is KYC verified
     */
    function isKYCVerified(address account) 
        external 
        view 
        returns (bool) 
    {
        KYCData memory kyc = kycStatus[account];
        return kyc.verified && block.timestamp <= kyc.expiryDate;
    }
    
    /**
     * @dev Gets all verification requests for an address
     */
    function getVerificationRequests(address account)
        external
        view
        returns (bytes32[] memory)
    {
        return userRequests[account];
    }
    
    /**
     * @dev Pauses KYC operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses KYC operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
