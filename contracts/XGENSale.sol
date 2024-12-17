// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IXGENToken.sol";
import "./interfaces/IXGENSale.sol";
import "./interfaces/IXGENVesting.sol";

/**
 * @title XGENSale
 * @notice Manages the XGEN token sale through Fjord Foundry integration
 */
contract XGENSale is IXGENSale, ReentrancyGuard, AccessControl, Pausable {
    // Custom errors
    error InvalidPriceMultiple(uint256 sent, uint256 price);
    error BelowMinimumPurchase(uint256 amount, uint256 minimum);
    error AboveMaximumPurchase(uint256 amount, uint256 maximum);
    error ExceedsAllocation(uint256 requested, uint256 remaining);
    error TransferFailed();
    error InvalidAmount();
    error NotStarted();
    error AlreadyEnded();
    error NotKYCApproved();
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    IXGENToken public immutable xgenToken;
    IXGENVesting public immutable vestingContract;
    
    uint256 public constant MIN_PURCHASE_TOKENS = 1000 * 10**18;  // 1000 tokens
    uint256 public constant MAX_PURCHASE_TOKENS = 100000 * 10**18;  // 100k tokens
    uint256 public constant TOTAL_TOKENS = 10_000_000 * 1e18; // 10M tokens
    
    uint256 public startTime;
    uint256 public endTime;
    uint256 public override totalSold;
    uint256 public override largestPurchase;
    uint256 public override smallestPurchase;
    uint256 public override totalParticipants;
    uint256 public override tokenPrice;
    
    mapping(address => bool) public kycApproved;
    mapping(address => uint256) public purchases;
    mapping(address => bool) public hasParticipated;
    
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event KYCStatusUpdated(address indexed account, bool status);
    event SaleTimingUpdated(uint256 newStart, uint256 newEnd);
    event SaleEnded(uint256 timestamp, uint256 totalSold);
    
    constructor(
        address token,
        address vesting,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _tokenPrice
    ) {
        require(token != address(0), "XGENSale: zero token address");
        require(vesting != address(0), "XGENSale: zero vesting address");
        require(_startTime > block.timestamp, "XGENSale: invalid start");
        require(_endTime > _startTime, "XGENSale: invalid end");
        require(_tokenPrice > 0, "XGENSale: invalid price");
        
        xgenToken = IXGENToken(token);
        vestingContract = IXGENVesting(vesting);
        startTime = _startTime;
        endTime = _endTime;
        tokenPrice = _tokenPrice;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Updates KYC status for an account
     */
    function updateKYCStatus(address account, bool status)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(account != address(0), "XGENSale: zero address");
        kycApproved[account] = status;
        emit KYCStatusUpdated(account, status);
    }
    
    /**
     * @dev Batch updates KYC status for multiple accounts
     */
    function batchUpdateKYCStatus(address[] calldata accounts, bool[] calldata statuses)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(accounts.length == statuses.length, "XGENSale: length mismatch");
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "XGENSale: zero address");
            kycApproved[accounts[i]] = statuses[i];
            emit KYCStatusUpdated(accounts[i], statuses[i]);
        }
    }
    
    /**
     * @dev Updates sale timing
     */
    function updateTiming(uint256 newStart, uint256 newEnd)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(newStart > block.timestamp, "XGENSale: invalid start");
        require(newEnd > newStart, "XGENSale: invalid end");
        
        startTime = newStart;
        endTime = newEnd;
        emit SaleTimingUpdated(newStart, newEnd);
    }
    
    /**
     * @dev Purchases tokens in the sale
     */
    function purchaseTokens()
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (block.timestamp < startTime) revert NotStarted();
        if (block.timestamp > endTime) revert AlreadyEnded();
        if (!kycApproved[msg.sender]) revert NotKYCApproved();
        if (msg.value == 0) revert InvalidAmount();
        
        // First check if the amount would result in a whole number of tokens
        // We do this by checking if msg.value * 1e18 is divisible by tokenPrice
        uint256 scaledAmount = msg.value * 1e18;
        if (scaledAmount % tokenPrice != 0) {
            revert InvalidPriceMultiple(msg.value, tokenPrice);
        }
        
        // Calculate number of tokens
        uint256 tokenAmount = scaledAmount / tokenPrice;
        
        // Check purchase limits
        if (tokenAmount < MIN_PURCHASE_TOKENS) {
            revert BelowMinimumPurchase(tokenAmount, MIN_PURCHASE_TOKENS);
        }
        if (tokenAmount > MAX_PURCHASE_TOKENS) {
            revert AboveMaximumPurchase(tokenAmount, MAX_PURCHASE_TOKENS);
        }
        if (totalSold + tokenAmount > TOTAL_TOKENS) {
            revert ExceedsAllocation(tokenAmount, TOTAL_TOKENS - totalSold);
        }
        
        // Update metrics
        totalSold += tokenAmount;
        purchases[msg.sender] += tokenAmount;
        
        if (!hasParticipated[msg.sender]) {
            hasParticipated[msg.sender] = true;
            totalParticipants++;
        }
        
        if (tokenAmount > largestPurchase) {
            largestPurchase = tokenAmount;
        }
        if (smallestPurchase == 0 || tokenAmount < smallestPurchase) {
            smallestPurchase = tokenAmount;
        }
        
        // Transfer tokens to vesting contract first
        if (!xgenToken.transfer(address(vestingContract), tokenAmount)) {
            revert TransferFailed();
        }
        
        // Set up vesting for the purchaser
        vestingContract.addBeneficiary(msg.sender, tokenAmount);
        
        emit TokensPurchased(msg.sender, tokenAmount, msg.value);
    }
    
    /**
     * @dev Ends the sale early if needed
     */
    function endSale() external override onlyRole(OPERATOR_ROLE) {
        require(block.timestamp >= startTime, "XGENSale: not started");
        endTime = block.timestamp;
        emit SaleEnded(block.timestamp, totalSold);
    }
    
    /**
     * @dev Pauses the sale
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses the sale
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Withdraws collected funds
     */
    function withdrawFunds(address payable to)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(to != address(0), "XGENSale: zero address");
        uint256 balance = address(this).balance;
        require(balance > 0, "XGENSale: no funds");
        
        (bool success, ) = to.call{value: balance}("");
        require(success, "XGENSale: withdrawal failed");
    }
    
    /**
     * @dev Approves vesting contract to transfer tokens
     */
    function approveVestingTransfer(uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(amount > 0, "XGENSale: invalid amount");
        xgenToken.approve(address(vestingContract), amount);
    }
}