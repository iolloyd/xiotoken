// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title XIO Token
 * @notice Main token for the XIO ecosystem on Hyperliquid L1
 * @dev Implements a fixed supply token with burn mechanics, role-based access, and rate limiting
 */
contract XIO is ERC20, ERC20Burnable, ERC20Permit, Pausable, AccessControl, ReentrancyGuard {
    using Address for address;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // Total supply: 1 billion tokens
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    
    // Constants from litepaper
    uint256 public constant BURN_PERCENTAGE = 20; // 20% of profits for burn
    uint256 public constant MAX_BURN_SUPPLY = TOTAL_SUPPLY / 2; // 50% max burn
    uint256 public constant QUARTERLY_BURN_INTERVAL = 90 days;
    
    // Rate limiting
    uint256 public rateLimitAmount;
    uint256 public rateLimitPeriod;
    mapping(address => uint256) public lastTransferTimestamp;
    mapping(address => uint256) public transferredInPeriod;
    mapping(address => bool) public isRateLimitExempt;
    
    // Tracking
    uint256 public totalBurned;
    uint256 public lastBurnTimestamp;
    uint256 public lastQuarterlyBurn;
    bool public firstBurnExecuted;
    
    // Emergency recovery
    address public emergencyRecoveryAddress;
    bool public emergencyMode;
    uint256 public constant EMERGENCY_DELAY = 24 hours;
    uint256 public emergencyActionTimestamp;
    
    // Events
    event TokensBurned(uint256 amount, uint256 totalBurned, uint256 timestamp);
    event QuarterlyBurnExecuted(uint256 amount, uint256 quarter, uint256 year);
    event RateLimitUpdated(uint256 amount, uint256 period);
    event RateLimitExemptionUpdated(address indexed account, bool status);
    event EmergencyModeActivated(uint256 timestamp);
    event EmergencyRecoveryAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event TransferLimitExceeded(address indexed from, address indexed to, uint256 amount, uint256 limit);

    /**
     * @dev Contract constructor
     * @param _rateLimitAmount Initial rate limit amount
     * @param _rateLimitPeriod Initial rate limit period
     * @param _emergencyRecovery Emergency recovery address
     */
    constructor(
        uint256 _rateLimitAmount,
        uint256 _rateLimitPeriod,
        address _emergencyRecovery
    ) 
        ERC20("XIO Token", "XIO")
        ERC20Permit("XIO Token")
    {
        require(_rateLimitAmount > 0, "XIO: Invalid rate limit");
        require(_rateLimitPeriod > 0, "XIO: Invalid period");
        require(_emergencyRecovery != address(0), "XIO: Invalid recovery address");

        rateLimitAmount = _rateLimitAmount;
        rateLimitPeriod = _rateLimitPeriod;
        emergencyRecoveryAddress = _emergencyRecovery;

        // Initialize burn tracking
        lastQuarterlyBurn = block.timestamp;
        firstBurnExecuted = false;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        
        // Set initial rate limit exemption for deployer
        isRateLimitExempt[msg.sender] = true;
        
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    /**
     * @dev Updates rate limit parameters
     * @param _amount New rate limit amount
     * @param _period New rate limit period
     */
    function updateRateLimit(uint256 _amount, uint256 _period)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(_amount > 0, "XIO: Invalid rate limit");
        require(_period > 0, "XIO: Invalid period");
        
        rateLimitAmount = _amount;
        rateLimitPeriod = _period;
        
        emit RateLimitUpdated(_amount, _period);
    }

    /**
     * @dev Updates rate limit exemption status
     * @param account Address to update
     * @param status New exemption status
     */
    function updateRateLimitExemption(address account, bool status)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(account != address(0), "XIO: Invalid address");
        isRateLimitExempt[account] = status;
        emit RateLimitExemptionUpdated(account, status);
    }

    /**
     * @dev Executes quarterly burn from profits
     * @param amount Amount to burn
     */
    function executeQuarterlyBurn(uint256 amount) 
        external 
        onlyRole(BURNER_ROLE) 
        nonReentrant 
    {
        require(amount > 0, "XIO: Zero burn amount");
        
        if (!firstBurnExecuted) {
            firstBurnExecuted = true;
            lastQuarterlyBurn = block.timestamp;
        } else {
            require(
                block.timestamp >= lastQuarterlyBurn + QUARTERLY_BURN_INTERVAL,
                "XIO: Too early for burn"
            );
        }
        
        require(totalBurned + amount <= MAX_BURN_SUPPLY, "XIO: Exceeds burn limit");
        
        totalBurned += amount;
        lastQuarterlyBurn = block.timestamp;
        lastBurnTimestamp = block.timestamp;
        
        _burn(msg.sender, amount);
        
        uint256 quarter = ((block.timestamp / 86400 / 90) + 1);
        uint256 year = ((block.timestamp / 86400 / 365) + 1970);
        
        emit TokensBurned(amount, totalBurned, block.timestamp);
        emit QuarterlyBurnExecuted(amount, quarter, year);
    }

    /**
     * @dev Updates emergency recovery address
     * @param newAddress New recovery address
     */
    function updateEmergencyRecovery(address newAddress)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newAddress != address(0), "XIO: Invalid address");
        address oldAddress = emergencyRecoveryAddress;
        emergencyRecoveryAddress = newAddress;
        emit EmergencyRecoveryAddressUpdated(oldAddress, newAddress);
    }

    /**
     * @dev Initiates emergency mode
     */
    function initiateEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!emergencyMode, "XIO: Already in emergency");
        emergencyMode = true;
        emergencyActionTimestamp = block.timestamp + EMERGENCY_DELAY;
        emit EmergencyModeActivated(block.timestamp);
    }

    /**
     * @dev Pauses token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Internal function to check and update rate limits
     */
    function _checkRateLimit(address from, uint256 amount) internal {
        if (isRateLimitExempt[from]) return;
        
        if (block.timestamp >= lastTransferTimestamp[from] + rateLimitPeriod) {
            transferredInPeriod[from] = 0;
            lastTransferTimestamp[from] = block.timestamp;
        }
        
        uint256 newAmount = transferredInPeriod[from] + amount;
        if (newAmount > rateLimitAmount) {
            emit TransferLimitExceeded(from, msg.sender, amount, rateLimitAmount);
            revert("XIO: Rate limit exceeded");
        }
        
        transferredInPeriod[from] = newAmount;
    }

    /**
     * @dev Override of the transfer hook to implement rate limiting
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
        
        if (from != address(0) && to != address(0)) {
            _checkRateLimit(from, amount);
        }
    }

    /**
     * @dev Returns burn statistics
     */
    function getBurnStats() external view returns (
        uint256 totalBurnt,
        uint256 remainingToBurn,
        uint256 maxBurnCap,
        uint256 nextBurnAllowed
    ) {
        return (
            totalBurned,
            MAX_BURN_SUPPLY - totalBurned,
            MAX_BURN_SUPPLY,
            lastQuarterlyBurn + QUARTERLY_BURN_INTERVAL
        );
    }

    /**
     * @dev Returns rate limit status for an address
     */
    function getRateLimitStatus(address account) external view returns (
        uint256 currentPeriodTransfers,
        uint256 remainingInPeriod,
        uint256 periodResetTime
    ) {
        uint256 resetTime = lastTransferTimestamp[account] + rateLimitPeriod;
        uint256 remaining = block.timestamp >= resetTime ? 
            rateLimitAmount : 
            rateLimitAmount - transferredInPeriod[account];
            
        return (
            transferredInPeriod[account],
            remaining,
            resetTime
        );
    }
}