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
    event RateLimitExceeded(address indexed from, address indexed to, uint256 amount);
    event TokenPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event InvestmentLimitsUpdated(uint256 minAmount, uint256 maxAmount);
    event VestingParametersUpdated(uint256 initialUnlock, uint256 cliff, uint256 duration);
    event RateLimitUpdated(uint256 amount, uint256 period);
    
    /**
     * @dev Contract constructor
     * @param name Token name
     * @param symbol Token symbol
     * @param _totalSupply Total token supply cap
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
        require(_totalSupply > 0, "XGEN: Total supply must be positive");
        require(_seedAllocation <= _totalSupply, "XGEN: Seed allocation exceeds total supply");
        require(_tokenPrice > 0, "XGEN: Token price must be positive");
        require(_rateLimitAmount > 0, "XGEN: Rate limit amount must be positive");
        require(_rateLimitPeriod > 0, "XGEN: Rate limit period must be positive");

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
        require(account != address(0), "XGEN: Cannot whitelist zero address");
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
        require(accounts.length == statuses.length, "XGEN: Length mismatch");
        require(accounts.length > 0, "XGEN: Empty arrays");
        
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "XGEN: Cannot whitelist zero address");
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
        require(newPrice > 0, "XGEN: Invalid price");
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
        require(_minInvestment > 0, "XGEN: Invalid min investment");
        require(_maxInvestment >= _minInvestment, "XGEN: Invalid max investment");
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
        require(_initialUnlock <= 100, "XGEN: Invalid unlock percentage");
        require(_cliff < _duration, "XGEN: Invalid cliff period");
        
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
        require(_amount > 0, "XGEN: Invalid rate limit amount");
        require(_period > 0, "XGEN: Invalid rate limit period");
        
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
    {
        require(to != address(0), "XGEN: Cannot mint to zero address");
        require(amount > 0, "XGEN: Amount must be positive");
        require(totalSupply() + amount <= totalSupplyCap, "XGEN: Exceeds max supply");
        require(whitelist[to], "XGEN: Address not whitelisted");
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
        require(from != address(0), "XGEN: Transfer from zero address");
        require(to != address(0), "XGEN: Transfer to zero address");
        require(amount > 0, "XGEN: Transfer amount must be positive");
        
        // Reset rate limit if period has passed
        if (block.timestamp >= lastTransferTimestamp[from] + rateLimitPeriod) {
            transferredInPeriod[from] = 0;
            lastTransferTimestamp[from] = block.timestamp;
        }
        
        // Check rate limit
        if (transferredInPeriod[from] + amount > rateLimitAmount) {
            emit RateLimitExceeded(from, to, amount);
            revert("XGEN: Rate limit exceeded");
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
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
        
        // Skip checks for minting
        if (from != address(0)) {
            require(whitelist[from] && whitelist[to], "XGEN: Address not whitelisted");
        }
    }

    /**
     * @dev Returns the number of decimals used to get its user representation
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}