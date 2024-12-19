// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IXGENToken.sol";
import "./interfaces/IXGENSale.sol";
import "./interfaces/IXGENVesting.sol";
import "./interfaces/IXGENKYC.sol";

/**
 * @title XGENSale
 * @notice Manages the XGEN token sale through Fjord Foundry integration
 */
contract XGENSale is IXGENSale, ReentrancyGuard, AccessControl, Pausable {
    // Custom errors
    error InvalidPriceMultiple(uint256 sent, uint256 required);
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
    IXGENKYC public immutable kycContract;
    
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
    
    // Track total purchases by KYC-verified identity
    mapping(bytes32 => uint256) private _identityPurchases;
    
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event KYCStatusUpdated(address indexed account, bool status);
    event SaleTimingUpdated(uint256 newStart, uint256 newEnd);
    event SaleEnded(uint256 timestamp, uint256 totalSold);
    
    constructor(
        address token,
        address vesting,
        address kyc,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _tokenPrice
    ) {
        require(token != address(0), "XGENSale: zero token address");
        require(vesting != address(0), "XGENSale: zero vesting address");
        require(kyc != address(0), "XGENSale: zero kyc address");
        require(_startTime > block.timestamp, "XGENSale: invalid start");
        require(_endTime > _startTime, "XGENSale: invalid end");
        require(_tokenPrice > 0, "XGENSale: invalid price");
        
        xgenToken = IXGENToken(token);
        vestingContract = IXGENVesting(vesting);
        kycContract = IXGENKYC(kyc);
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
     * @dev Calculate the exact ETH amount needed to purchase a specific number of tokens
     * @param tokenAmount The number of tokens to purchase (in wei)
     * @return The exact amount of ETH needed (in wei)
     */
    function calculateExactEthAmount(uint256 tokenAmount) public view returns (uint256) {
        return (tokenAmount * tokenPrice) / 1e18;
    }

    /**
     * @dev Calculate the number of tokens that can be purchased with a specific ETH amount
     * @param ethAmount The amount of ETH to spend (in wei)
     * @return tokenAmount The number of tokens that can be purchased
     * @return remainingEth Any ETH that would be left over due to price multiple
     */
    function calculatePurchaseAmount(uint256 ethAmount) public view returns (uint256 tokenAmount, uint256 remainingEth) {
        uint256 scaledAmount = ethAmount * 1e18;
        tokenAmount = scaledAmount / tokenPrice;
        uint256 exactEthNeeded = calculateExactEthAmount(tokenAmount);
        remainingEth = ethAmount - exactEthNeeded;
        return (tokenAmount, remainingEth);
    }

    /**
     * @dev Purchases tokens in the sale
     */
    function purchaseTokens()
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        if (block.timestamp < startTime) revert NotStarted();
        if (block.timestamp > endTime) revert AlreadyEnded();
        if (!kycApproved[msg.sender]) revert NotKYCApproved();
        if (msg.value == 0) revert InvalidAmount();

        // Calculate exact token amount and check for valid price multiple
        (uint256 tokenAmount, uint256 remainingEth) = calculatePurchaseAmount(msg.value);
        if (remainingEth > 0) {
            revert InvalidPriceMultiple(msg.value, msg.value - remainingEth);
        }

        if (tokenAmount < MIN_PURCHASE_TOKENS) {
            revert BelowMinimumPurchase(tokenAmount, MIN_PURCHASE_TOKENS);
        }
        if (tokenAmount > MAX_PURCHASE_TOKENS) {
            revert AboveMaximumPurchase(tokenAmount, MAX_PURCHASE_TOKENS);
        }
        if (totalSold + tokenAmount > TOTAL_TOKENS) {
            revert ExceedsAllocation(tokenAmount, TOTAL_TOKENS - totalSold);
        }

        // Update purchase tracking
        purchases[msg.sender] += tokenAmount;
        totalSold += tokenAmount;

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

        // Transfer tokens to vesting contract
        if (!xgenToken.transfer(address(vestingContract), tokenAmount)) {
            revert TransferFailed();
        }

        // Set up vesting for the buyer
        vestingContract.setupVesting(msg.sender, tokenAmount);

        emit TokensPurchased(msg.sender, tokenAmount, msg.value);
        return tokenAmount;
    }
    
    /**
     * @dev Get total purchases for a KYC identity
     * @param identityHash The KYC identity hash
     * @return Total amount of tokens purchased by this identity
     */
    function getIdentityPurchases(bytes32 identityHash) external view returns (uint256) {
        return _identityPurchases[identityHash];
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