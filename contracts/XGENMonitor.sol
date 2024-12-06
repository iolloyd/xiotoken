// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./XGEN.sol";
import "./XGENSale.sol";
import "./XGENVesting.sol";

/**
 * @title XGENMonitor
 * @notice Monitors and tracks metrics for the XGEN token ecosystem
 */
contract XGENMonitor is AccessControl {
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");
    
    XGEN public immutable xgenToken;
    XGENSale public immutable saleContract;
    XGENVesting public immutable vestingContract;
    
    struct SaleMetrics {
        uint256 totalParticipants;
        uint256 totalRaised;
        uint256 tokensSold;
        uint256 averagePurchase;
        uint256 largestPurchase;
        uint256 smallestPurchase;
    }
    
    struct VestingMetrics {
        uint256 totalBeneficiaries;
        uint256 totalVested;
        uint256 totalClaimed;
        uint256 remainingToVest;
    }
    
    struct TokenMetrics {
        uint256 totalSupply;
        uint256 circulatingSupply;
        uint256 holders;
        uint256 transfers24h;
    }
    
    // Tracking variables
    mapping(address => bool) public isParticipant;
    mapping(uint256 => uint256) public dailyTransfers;
    mapping(address => bool) public isHolder;
    uint256 public currentDay;
    uint256 public totalHolders;
    
    event MetricsUpdated(
        uint256 timestamp,
        uint256 totalParticipants,
        uint256 totalRaised,
        uint256 tokensSold
    );
    
    event HolderAdded(address indexed holder);
    event HolderRemoved(address indexed holder);
    
    constructor(
        address token,
        address sale,
        address vesting
    ) {
        xgenToken = XGEN(token);
        saleContract = XGENSale(sale);
        vestingContract = XGENVesting(vesting);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MONITOR_ROLE, msg.sender);
        
        currentDay = block.timestamp / 1 days;
    }
    
    /**
     * @dev Updates daily transfer count
     */
    function recordTransfer(address from, address to, uint256 amount)
        external
        onlyRole(MONITOR_ROLE)
    {
        uint256 today = block.timestamp / 1 days;
        if (today > currentDay) {
            currentDay = today;
            dailyTransfers[today] = 0;
        }
        dailyTransfers[today]++;
        
        // Update holder statistics
        if (amount > 0) {
            if (!isHolder[to] && xgenToken.balanceOf(to) > 0) {
                isHolder[to] = true;
                totalHolders++;
                emit HolderAdded(to);
            }
            if (isHolder[from] && xgenToken.balanceOf(from) == 0) {
                isHolder[from] = false;
                totalHolders--;
                emit HolderRemoved(from);
            }
        }
    }
    
    /**
     * @dev Returns current sale metrics
     */
    function getSaleMetrics()
        external
        view
        returns (SaleMetrics memory)
    {
        return SaleMetrics({
            totalParticipants: saleContract.totalSold() > 0 ? _countParticipants() : 0,
            totalRaised: address(saleContract).balance,
            tokensSold: saleContract.totalSold(),
            averagePurchase: _calculateAveragePurchase(),
            largestPurchase: _findLargestPurchase(),
            smallestPurchase: _findSmallestPurchase()
        });
    }
    
    /**
     * @dev Returns current vesting metrics
     */
    function getVestingMetrics()
        external
        view
        returns (VestingMetrics memory)
    {
        return VestingMetrics({
            totalBeneficiaries: _countBeneficiaries(),
            totalVested: _calculateTotalVested(),
            totalClaimed: _calculateTotalClaimed(),
            remainingToVest: _calculateRemainingToVest()
        });
    }
    
    /**
     * @dev Returns current token metrics
     */
    function getTokenMetrics()
        external
        view
        returns (TokenMetrics memory)
    {
        return TokenMetrics({
            totalSupply: xgenToken.totalSupply(),
            circulatingSupply: _calculateCirculatingSupply(),
            holders: totalHolders,
            transfers24h: dailyTransfers[currentDay]
        });
    }
    
    // Internal helper functions
    function _countParticipants() internal view returns (uint256) {
        uint256 count = 0;
        uint256 balance = xgenToken.balanceOf(address(vestingContract));
        require(balance > 0, "XGENMonitor: No participants yet");
        return count;
    }
    
    function _calculateAveragePurchase() internal view returns (uint256) {
        uint256 totalParticipants = _countParticipants();
        if (totalParticipants == 0) return 0;
        return saleContract.totalSold() / totalParticipants;
    }
    
    function _findLargestPurchase() internal view returns (uint256) {
        return 0; // Implement tracking logic
    }
    
    function _findSmallestPurchase() internal view returns (uint256) {
        return 0; // Implement tracking logic
    }
    
    function _countBeneficiaries() internal view returns (uint256) {
        return 0; // Implement counting logic
    }
    
    function _calculateTotalVested() internal view returns (uint256) {
        return 0; // Implement vesting calculation
    }
    
    function _calculateTotalClaimed() internal view returns (uint256) {
        return 0; // Implement claimed calculation
    }
    
    function _calculateRemainingToVest() internal view returns (uint256) {
        return 0; // Implement remaining calculation
    }
    
    function _calculateCirculatingSupply() internal view returns (uint256) {
        uint256 totalSupply = xgenToken.totalSupply();
        uint256 vestingBalance = xgenToken.balanceOf(address(vestingContract));
        return totalSupply - vestingBalance;
    }
}
