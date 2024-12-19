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
        bytes32 identityHash;    // Hash of KYC documents (e.g., passport number)
    }
    
    struct VerificationRequest {
        address applicant;
        string documentHash;
        bytes32 identityHash;    // Hash of KYC documents
        uint256 timestamp;
        bool processed;
        bool approved;
    }
    
    // KYC status mapping
    mapping(address => KYCData) public kycStatus;
    
    // Identity hash to address mapping to prevent duplicate identities
    mapping(bytes32 => address) public identityToAddress;
    
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
    event DuplicateIdentityAttempt(bytes32 indexed identityHash, address newAddress, address existingAddress);
    
    error DuplicateIdentity(address existingAddress);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    /**
     * @dev Submit a KYC verification request
     * @param documentHash Hash of KYC documents
     * @param identityHash Unique hash of identity documents (e.g., passport number)
     */
    function submitKYCRequest(
        string calldata documentHash,
        bytes32 identityHash
    ) external whenNotPaused nonReentrant {
        require(identityHash != bytes32(0), "Invalid identity hash");
        
        // Check if this identity is already registered to another address
        address existingAddress = identityToAddress[identityHash];
        if (existingAddress != address(0) && existingAddress != msg.sender) {
            emit DuplicateIdentityAttempt(identityHash, msg.sender, existingAddress);
            revert DuplicateIdentity(existingAddress);
        }

        bytes32 requestId = keccak256(
            abi.encodePacked(msg.sender, documentHash, block.timestamp)
        );
        
        verificationRequests[requestId] = VerificationRequest({
            applicant: msg.sender,
            documentHash: documentHash,
            identityHash: identityHash,
            timestamp: block.timestamp,
            processed: false,
            approved: false
        });
        
        userRequests[msg.sender].push(requestId);
        emit KYCRequestSubmitted(requestId, msg.sender);
    }

    /**
     * @dev Verify KYC for an account
     * @param account Address to verify
     * @param requestId Request ID to process
     * @param level Verification level
     * @param expiryDays Number of days until expiry
     */
    function verifyKYC(
        address account,
        bytes32 requestId,
        string calldata level,
        uint256 expiryDays
    ) external whenNotPaused onlyRole(VERIFIER_ROLE) {
        require(account != address(0), "Invalid address");
        require(expiryDays > 0, "Invalid expiry");
        
        VerificationRequest storage request = verificationRequests[requestId];
        require(!request.processed, "Request already processed");
        require(request.applicant == account, "Account mismatch");
        
        // Check for duplicate identity
        address existingAddress = identityToAddress[request.identityHash];
        if (existingAddress != address(0) && existingAddress != account) {
            emit DuplicateIdentityAttempt(request.identityHash, account, existingAddress);
            revert DuplicateIdentity(existingAddress);
        }
        
        // Mark this identity as registered to this address
        identityToAddress[request.identityHash] = account;
        
        request.processed = true;
        request.approved = true;
        
        kycStatus[account] = KYCData({
            verified: true,
            verificationDate: block.timestamp,
            expiryDate: block.timestamp + (expiryDays * 1 days),
            verificationLevel: level,
            verifier: msg.sender,
            identityHash: request.identityHash
        });
        
        emit KYCVerified(account, level, block.timestamp + (expiryDays * 1 days));
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
