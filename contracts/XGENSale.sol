// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./XGEN.sol";
import "./XGENVesting.sol";

/**
 * @title XGENSale
 * @notice Manages the XGEN token sale through Fjord Foundry integration
 */
contract XGENSale is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    XGEN public immutable xgenToken;
    XGENVesting public immutable vestingContract;
    
    uint256 public constant PRICE = 100_000_000;         // $0.10 in wei
    uint256 public constant MIN_PURCHASE = 1_000 * 1e18; // $1,000
    uint256 public constant MAX_PURCHASE = 50_000 * 1e18;// $50,000
    uint256 public constant TOTAL_TOKENS = 10_000_000 * 1e18; // 10M tokens
    
    uint256 public startTime;
    uint256 public endTime;
    uint256 public totalSold;
    
    mapping(address => bool) public kycApproved;
    mapping(address => uint256) public purchases;
    
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event KYCStatusUpdated(address indexed account, bool status);
    event SaleTimingUpdated(uint256 newStart, uint256 newEnd);
    
    constructor(
        address token,
        address vesting,
        uint256 _startTime,
        uint256 _endTime
    ) {
        require(_startTime > block.timestamp, "XGENSale: invalid start");
        require(_endTime > _startTime, "XGENSale: invalid end");
        
        xgenToken = XGEN(token);
        vestingContract = XGENVesting(vesting);
        startTime = _startTime;
        endTime = _endTime;
        
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
        require(block.timestamp >= startTime, "XGENSale: not started");
        require(block.timestamp <= endTime, "XGENSale: ended");
        require(kycApproved[msg.sender], "XGENSale: KYC required");
        require(msg.value >= MIN_PURCHASE, "XGENSale: below minimum");
        require(msg.value <= MAX_PURCHASE, "XGENSale: above maximum");
        
        uint256 tokenAmount = (msg.value * 1e18) / PRICE;
        require(totalSold + tokenAmount <= TOTAL_TOKENS, "XGENSale: exceeds allocation");
        
        totalSold += tokenAmount;
        purchases[msg.sender] += tokenAmount;
        
        // Set up vesting for the purchaser
        vestingContract.addBeneficiary(msg.sender, tokenAmount);
        
        emit TokensPurchased(msg.sender, tokenAmount, msg.value);
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
}
