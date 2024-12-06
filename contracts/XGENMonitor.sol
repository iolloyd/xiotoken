// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IXGENToken.sol";
import "./interfaces/IXGENSale.sol";
import "./interfaces/IXGENVesting.sol";

/**
 * @title XGENMonitor
 * @notice Monitors and tracks metrics for the XGEN token ecosystem
 */
contract XGENMonitor is AccessControl {
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");
    
    IXGENToken public immutable xgenToken;
    IXGENSale public immutable saleContract;
    IXGENVesting public immutable vestingContract;
    
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
        require(token != address(0), "XGENMonitor: zero token address");
        require(sale != address(0), "XGENMonitor: zero sale address");
        require(vesting != address(0), "XGENMonitor: zero vesting address");

        xgenToken = IXGENToken(token);
        saleContract = IXGENSale(sale);
        vestingContract = IXGENVesting(vesting);
        
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
            totalParticipants: saleContract.totalParticipants(),
            totalRaised: address(saleContract).balance,
            tokensSold: saleContract.totalSold(),
            averagePurchase: _calculateAveragePurchase(),
            largestPurchase: saleContract.largestPurchase(),
            smallestPurchase: saleContract.smallestPurchase()
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
            totalBeneficiaries: vestingContract.totalBeneficiaries(),
            totalVested: vestingContract.totalVested(),
            totalClaimed: vestingContract.totalClaimed(),
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
    function _calculateAveragePurchase() internal view returns (uint256) {
        uint256 totalParticipants = saleContract.totalParticipants();
        if (totalParticipants == 0) return 0;
        return saleContract.totalSold() / totalParticipants;
    }
    
    function _calculateRemainingToVest() internal view returns (uint256) {
        return vestingContract.totalVested() - vestingContract.totalClaimed();
    }
    
    function _calculateCirculatingSupply() internal view returns (uint256) {
        uint256 totalSupply = xgenToken.totalSupply();
        uint256 vestingBalance = xgenToken.balanceOf(address(vestingContract));
        uint256 saleBalance = xgenToken.balanceOf(address(saleContract));
        return totalSupply - vestingBalance - saleBalance;
    }
}