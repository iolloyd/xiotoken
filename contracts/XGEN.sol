// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

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
    error InvalidAmount();
    error InvalidPrice();
    error InvalidPeriod();
    error InvalidPercentage();
    error InvalidInvestmentLimits();
    error EmptyArrays();
    error LengthMismatch();
    error InvalidCliffPeriod();
    
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant CONFIGURATOR_ROLE = keccak256("CONFIGURATOR_ROLE");
    
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
    
    // Rate limiting
    uint256 public rateLimitAmount;
    uint256 public rateLimitPeriod;
    mapping(address => uint256) public lastTransferTimestamp;
    mapping(address => uint256) public transferredInPeriod;
    
    // Whitelisting
    mapping(address => bool) public whitelist;
    
    // Events
    event WhitelistUpdated(address indexed account, bool status);
    event TokenPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event InvestmentLimitsUpdated(uint256 minAmount, uint256 maxAmount);
    event VestingParametersUpdated(uint256 initialUnlock, uint256 cliff, uint256 duration);
    event RateLimitUpdated(uint256 amount, uint256 period);
    
    // Modifiers
    modifier isWhitelisted(address account) {
        if (!whitelist[account]) revert NotWhitelisted(account);
        _;
    }
    
    /**
     * @dev Contract constructor
     * @param name Token name
     * @param symbol Token symbol
     * @param _totalSupply Total token supply cap (1B tokens)
     * @param _seedAllocation Allocation for seed round
     * @param _tokenPrice Initial token price
     * @param _rateLimitAmount Initial rate limit amount
     * @param _rateLimitPeriod Initial rate limit period
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 _totalSupply,
        uint256 _seedAllocation,
        uint256 _tokenPrice,
        uint256 _rateLimitAmount,
        uint256 _rateLimitPeriod
    ) 
        ERC20(name, symbol)
        ERC20Permit(name) 
    {
        if (_totalSupply == 0) revert InvalidAmount();
        if (_seedAllocation > _totalSupply) revert InvalidAmount();
        if (_tokenPrice == 0) revert InvalidPrice();
        if (_rateLimitAmount == 0) revert InvalidAmount();
        if (_rateLimitPeriod == 0) revert InvalidPeriod();

        totalSupplyCap = _totalSupply;
        seedRoundAllocation = _seedAllocation;
        tokenPrice = _tokenPrice;
        rateLimitAmount = _rateLimitAmount;
        rateLimitPeriod = _rateLimitPeriod;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(CONFIGURATOR_ROLE, msg.sender);
        
        // Mint initial supply to deployer
        _mint(msg.sender, _totalSupply);
    }
    
    /**
     * @dev Updates whitelist status for an account
     * @param account Address to update
     * @param status New whitelist status
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
     * @param accounts Addresses to update
     * @param statuses New whitelist statuses
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
     * @param newPrice New token price
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
     * @param _minInvestment New minimum investment
     * @param _maxInvestment New maximum investment
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
     * @dev Updates vesting parameters
     * @param _initialUnlock Initial unlock percentage
     * @param _cliff Cliff period
     * @param _duration Total vesting duration
     */
    function updateVestingParameters(
        uint256 _initialUnlock,
        uint256 _cliff,
        uint256 _duration
    )
        external
        onlyRole(CONFIGURATOR_ROLE)
    {
        if (_initialUnlock > 100) revert InvalidPercentage();
        if (_cliff >= _duration) revert InvalidCliffPeriod();
        
        initialUnlockPercent = _initialUnlock;
        cliffPeriod = _cliff;
        vestingDuration = _duration;
        
        emit VestingParametersUpdated(_initialUnlock, _cliff, _duration);
    }

    /**
     * @dev Updates rate limiting parameters
     * @param _amount New rate limit amount
     * @param _period New rate limit period
     */
    function updateRateLimit(uint256 _amount, uint256 _period)
        external
        onlyRole(CONFIGURATOR_ROLE)
    {
        if (_amount == 0) revert InvalidAmount();
        if (_period == 0) revert InvalidPeriod();
        
        rateLimitAmount = _amount;
        rateLimitPeriod = _period;
        
        emit RateLimitUpdated(_amount, _period);
    }

    /**
     * @dev Pauses all token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Mints new tokens
     * @param to Address to receive the tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE)
        nonReentrant 
        isWhitelisted(to)
    {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (totalSupply() + amount > totalSupplyCap) revert ExceedsMaxSupply();
        
        _mint(to, amount);
    }

    /**
     * @dev Internal transfer with rate limiting
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        
        // Reset rate limit if period has passed
        if (block.timestamp >= lastTransferTimestamp[from] + rateLimitPeriod) {
            transferredInPeriod[from] = 0;
            lastTransferTimestamp[from] = block.timestamp;
        }
        
        // Check rate limit
        if (transferredInPeriod[from] + amount > rateLimitAmount) {
            revert RateLimitExceeded(from, to, amount);
        }
        
        transferredInPeriod[from] += amount;
        super._transfer(from, to, amount);
    }

    /**
     * @dev Adds pre-transfer checks
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal override whenNotPaused {
        // Skip checks for minting
        if (from != address(0)) {
            if (!whitelist[from] || !whitelist[to]) revert NotWhitelisted(from);
        }
    }
}