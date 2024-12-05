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
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18;  // 100M total supply
    uint256 public constant SEED_ROUND_ALLOCATION = 10_000_000 * 10**18;  // 10M for seed round
    
    // Sale parameters
    uint256 public constant TOKEN_PRICE = 100_000_000;  // $0.10 in wei
    uint256 public constant MIN_INVESTMENT = 1_000 * 10**18;  // $1,000 minimum
    uint256 public constant MAX_INVESTMENT = 50_000 * 10**18;  // $50,000 maximum
    
    // Vesting parameters
    uint256 public constant INITIAL_UNLOCK_PERCENT = 10;  // 10% at TGE
    uint256 public constant CLIFF_PERIOD = 180 days;  // 6 months cliff
    uint256 public constant VESTING_DURATION = 540 days;  // 18 months total
    
    // Rate limiting
    uint256 public constant RATE_LIMIT_AMOUNT = 100_000 * 10**18;  // 100k tokens
    uint256 public constant RATE_LIMIT_PERIOD = 1 hours;
    mapping(address => uint256) public lastTransferTimestamp;
    mapping(address => uint256) public transferredInPeriod;
    
    // Whitelisting
    mapping(address => bool) public whitelist;
    
    // Events
    event WhitelistUpdated(address indexed account, bool status);
    event RateLimitExceeded(address indexed from, address indexed to, uint256 amount);
    
    /**
     * @dev Constructor that gives msg.sender all roles
     */
    constructor() 
        ERC20("XGEN Token", "XGEN")
        ERC20Permit("XGEN Token") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(CONFIGURATOR_ROLE, msg.sender);
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
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelist[accounts[i]] = statuses[i];
            emit WhitelistUpdated(accounts[i], statuses[i]);
        }
    }

    /**
     * @dev Pauses all token transfers
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Mints new tokens
     * @param to Address to receive the tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) 
        public 
        onlyRole(MINTER_ROLE)
        nonReentrant 
    {
        require(totalSupply() + amount <= TOTAL_SUPPLY, "XGEN: Exceeds max supply");
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
        // Reset rate limit if period has passed
        if (block.timestamp >= lastTransferTimestamp[from] + RATE_LIMIT_PERIOD) {
            transferredInPeriod[from] = 0;
            lastTransferTimestamp[from] = block.timestamp;
        }
        
        // Check rate limit
        require(
            transferredInPeriod[from] + amount <= RATE_LIMIT_AMOUNT,
            "XGEN: Rate limit exceeded"
        );
        
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
}