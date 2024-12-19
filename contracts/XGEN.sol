// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title XGEN Token
 * @notice Placeholder token for XIO ecosystem, to be swapped 1:1 for XIO token
 * @dev Implements ERC20 with role-based access control, pause functionality, and burnable features
 */
contract XGEN is ERC20, ERC20Burnable, Pausable, AccessControl, ERC20Permit, ReentrancyGuard {
    // Custom errors for gas optimization
    error NotWhitelisted(address account);
    error InvalidAddress();
    error ExceedsMaxSupply();
    error RateLimitExceeded(address from, address to, uint256 amount);
    error GlobalRateLimitExceeded(bytes32 identityHash);
    error InvalidAmount();
    error InvalidPrice();
    error InvalidPeriod();
    error InvalidPercentage();
    error InvalidInvestmentLimits();
    error EmptyArrays();
    error LengthMismatch();
    error InvalidCliffPeriod();
    error RoleChangeNotRequested();
    error TimelockNotExpired();
    error RoleAlreadyAssigned();
    error InvalidIdentityHash();
    
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant CONFIGURATOR_ROLE = keccak256("CONFIGURATOR_ROLE");
    
    uint256 public constant TIMELOCK_DELAY = 2 days;
    uint256 public constant GLOBAL_RATE_LIMIT = 1000000e18; // 1M tokens
    uint256 public constant SUSPICIOUS_TRANSFER_COUNT = 10;
    uint256 public constant SUSPICIOUS_TRANSFER_WINDOW = 1 hours;
    
    // Token supply parameters
    uint256 public immutable totalSupplyCap;
    uint256 public immutable seedRoundAllocation;
    
    // Sale parameters
    uint256 public tokenPrice;
    uint256 public minInvestment;
    uint256 public maxInvestment;
    
    // Vesting parameters
    uint256 public initialUnlockPercent;
    uint256 public cliffPeriod;
    uint256 public vestingDuration;
    
    // Rate limiting with identity tracking
    struct RateLimit {
        uint256 amount;
        uint256 lastResetTime;
        bytes32 identityHash;
        uint256 transferCount;
    }
    
    mapping(address => RateLimit) public rateLimits;
    mapping(bytes32 => uint256) public identityTransfers;
    mapping(bytes32 => uint256) public identityTransferCount;
    mapping(bytes32 => uint256) public roleChangeRequests;
    
    // Whitelisting
    mapping(address => bool) public whitelist;
    
    // Events
    event WhitelistUpdated(address indexed account, bool status);
    event TokenPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event InvestmentLimitsUpdated(uint256 minAmount, uint256 maxAmount);
    event VestingParametersUpdated(uint256 initialUnlock, uint256 cliff, uint256 duration);
    event RateLimitUpdated(address indexed account, uint256 amount, uint256 timestamp);
    event SuspiciousActivityDetected(bytes32 indexed identityHash, uint256 transferCount);
    event RoleChangeRequested(bytes32 role, address account, uint256 executeTime);
    event RoleChangeExecuted(bytes32 role, address account);
    event IdentityHashSet(address indexed account, bytes32 identityHash);
    
    // Modifiers
    modifier isWhitelisted(address account) {
        if (!whitelist[account]) revert NotWhitelisted(account);
        _;
    }
    
    /**
     * @dev Contract constructor
     * @param name Token name
     * @param symbol Token symbol
     * @param _totalSupply Total token supply cap
     * @param _seedAllocation Allocation for seed round
     * @param _tokenPrice Initial token price
     * @param _admin Admin role address
     * @param _pauser Pauser role address
     * @param _minter Minter role address
     * @param _configurator Configurator role address
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 _totalSupply,
        uint256 _seedAllocation,
        uint256 _tokenPrice,
        address _admin,
        address _pauser,
        address _minter,
        address _configurator
    ) 
        ERC20(name, symbol)
        ERC20Permit(name) 
    {
        if (_totalSupply == 0) revert InvalidAmount();
        if (_seedAllocation > _totalSupply) revert InvalidAmount();
        if (_tokenPrice == 0) revert InvalidPrice();
        if (_admin == address(0)) revert InvalidAddress();
        
        require(_admin != _pauser && _admin != _minter && _admin != _configurator, 
                "Roles must be separate");

        totalSupplyCap = _totalSupply;
        seedRoundAllocation = _seedAllocation;
        tokenPrice = _tokenPrice;

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(PAUSER_ROLE, _pauser);
        _setupRole(MINTER_ROLE, _minter);
        _setupRole(CONFIGURATOR_ROLE, _configurator);
        
        emit RoleChangeExecuted(DEFAULT_ADMIN_ROLE, _admin);
        emit RoleChangeExecuted(PAUSER_ROLE, _pauser);
        emit RoleChangeExecuted(MINTER_ROLE, _minter);
        emit RoleChangeExecuted(CONFIGURATOR_ROLE, _configurator);
        
        // Mint initial supply to admin
        _mint(_admin, _totalSupply);
    }
    
    /**
     * @dev Requests a role change with timelock
     */
    function requestRoleChange(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        if (hasRole(role, account)) revert RoleAlreadyAssigned();
        
        bytes32 requestId = keccak256(abi.encodePacked(role, account));
        roleChangeRequests[requestId] = block.timestamp + TIMELOCK_DELAY;
        
        emit RoleChangeRequested(role, account, roleChangeRequests[requestId]);
    }
    
    /**
     * @dev Executes a pending role change after timelock expires
     */
    function executeRoleChange(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 requestId = keccak256(abi.encodePacked(role, account));
        if (roleChangeRequests[requestId] == 0) revert RoleChangeNotRequested();
        if (block.timestamp < roleChangeRequests[requestId]) revert TimelockNotExpired();
        
        _grantRole(role, account);
        delete roleChangeRequests[requestId];
        
        emit RoleChangeExecuted(role, account);
    }
    
    /**
     * @dev Updates whitelist status for an account
     */
    function updateWhitelist(address account, bool status) 
        external 
        onlyRole(CONFIGURATOR_ROLE) 
    {
        if (account == address(0)) revert InvalidAddress();
        whitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }
    
    /**
     * @dev Batch update whitelist status
     */
    function batchUpdateWhitelist(address[] calldata accounts, bool[] calldata statuses)
        external
        onlyRole(CONFIGURATOR_ROLE)
    {
        if (accounts.length != statuses.length) revert LengthMismatch();
        if (accounts.length == 0) revert EmptyArrays();
        
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) revert InvalidAddress();
            whitelist[accounts[i]] = statuses[i];
            emit WhitelistUpdated(accounts[i], statuses[i]);
        }
    }

    /**
     * @dev Updates token price
     */
    function updateTokenPrice(uint256 newPrice)
        external
        onlyRole(CONFIGURATOR_ROLE)
    {
        if (newPrice == 0) revert InvalidPrice();
        emit TokenPriceUpdated(tokenPrice, newPrice);
        tokenPrice = newPrice;
    }

    /**
     * @dev Updates investment limits
     */
    function updateInvestmentLimits(uint256 _minInvestment, uint256 _maxInvestment)
        external
        onlyRole(CONFIGURATOR_ROLE)
    {
        if (_minInvestment == 0) revert InvalidAmount();
        if (_maxInvestment < _minInvestment) revert InvalidInvestmentLimits();
        
        minInvestment = _minInvestment;
        maxInvestment = _maxInvestment;
        emit InvestmentLimitsUpdated(_minInvestment, _maxInvestment);
    }

    /**
     * @dev Sets identity hash for rate limiting
     */
    function setIdentityHash(address account, bytes32 identityHash) 
        external 
        onlyRole(CONFIGURATOR_ROLE) 
    {
        if (identityHash == bytes32(0)) revert InvalidIdentityHash();
        rateLimits[account].identityHash = identityHash;
        emit IdentityHashSet(account, identityHash);
    }

    /**
     * @dev Internal transfer with enhanced rate limiting
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        
        // Update rate limits
        _updateRateLimit(from);
        _updateRateLimit(to);
        
        // Check identity-based limits
        bytes32 fromIdentity = rateLimits[from].identityHash;
        if (fromIdentity != bytes32(0)) {
            if (identityTransfers[fromIdentity] + amount > GLOBAL_RATE_LIMIT) {
                revert GlobalRateLimitExceeded(fromIdentity);
            }
            
            // Update transfer patterns
            identityTransferCount[fromIdentity]++;
            if (_isTransferPatternSuspicious(fromIdentity)) {
                emit SuspiciousActivityDetected(fromIdentity, identityTransferCount[fromIdentity]);
            }
            
            identityTransfers[fromIdentity] += amount;
        }
        
        // Update individual address limits
        unchecked {
            rateLimits[from].amount += amount;
            rateLimits[from].transferCount++;
        }
        
        super._transfer(from, to, amount);
    }

    /**
     * @dev Updates rate limit state
     */
    function _updateRateLimit(address account) internal {
        RateLimit storage limit = rateLimits[account];
        
        if (block.timestamp >= limit.lastResetTime + SUSPICIOUS_TRANSFER_WINDOW) {
            uint256 periods = (block.timestamp - limit.lastResetTime) / SUSPICIOUS_TRANSFER_WINDOW;
            uint256 reduction = (limit.amount * periods) / 1;
            
            limit.amount = reduction > limit.amount ? 0 : limit.amount - reduction;
            limit.lastResetTime = block.timestamp;
            limit.transferCount = 0;
            
            emit RateLimitUpdated(account, limit.amount, block.timestamp);
        }
    }
    
    /**
     * @dev Checks for suspicious transfer patterns
     */
    function _isTransferPatternSuspicious(bytes32 identityHash) internal view returns (bool) {
        return identityTransferCount[identityHash] > SUSPICIOUS_TRANSFER_COUNT;
    }

    /**
     * @dev Adds pre-transfer checks
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal view override whenNotPaused {
        // Skip checks for minting
        if (from != address(0)) {
            if (!whitelist[from] || !whitelist[to]) revert NotWhitelisted(from);
        }
    }
}
