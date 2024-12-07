// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./XGEN.sol";

/**
 * @title XGENVesting
 * @notice Manages token vesting for XGEN token seed round participants
 */
contract XGENVesting is AccessControl, ReentrancyGuard {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    XGEN public immutable xgenToken;
    
    uint64 public constant INITIAL_UNLOCK_PERCENT = 10;
    uint64 public constant VESTING_DURATION = 540 days; // 18 months
    uint64 public constant CLIFF_DURATION = 180 days;   // 6 months
    
    uint64 public immutable startTimestamp;
    
    mapping(address => uint256) public beneficiaryAllocations;
    mapping(address => uint256) public initialUnlockClaimed;
    mapping(address => uint256) public totalClaimed;
    
    event BeneficiaryAdded(address indexed beneficiary, uint256 allocation);
    event InitialUnlockClaimed(address indexed beneficiary, uint256 amount);
    event TokensClaimed(address indexed beneficiary, uint256 amount);
    
    constructor(address token) {
        require(token != address(0), "XGENVesting: zero address");
        xgenToken = XGEN(token);
        startTimestamp = uint64(block.timestamp);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @dev Adds a beneficiary with their allocation
     * @param beneficiary Address of the beneficiary
     * @param allocation Total token allocation for the beneficiary
     */
    function addBeneficiary(address beneficiary, uint256 allocation)
        external
        onlyRole(MANAGER_ROLE)
        nonReentrant
    {
        require(beneficiary != address(0), "XGENVesting: zero address");
        require(allocation > 0, "XGENVesting: zero allocation");
        require(beneficiaryAllocations[beneficiary] == 0, "XGENVesting: already added");
        
        beneficiaryAllocations[beneficiary] = allocation;
        emit BeneficiaryAdded(beneficiary, allocation);
    }
    
    /**
     * @dev Claims initial unlock tokens (10% of allocation)
     */
    function claimInitialUnlock()
        external
        nonReentrant
    {
        require(block.timestamp >= startTimestamp, "XGENVesting: not started");
        require(beneficiaryAllocations[msg.sender] > 0, "XGENVesting: no allocation");
        require(initialUnlockClaimed[msg.sender] == 0, "XGENVesting: already claimed");
        
        uint256 unlockAmount = (beneficiaryAllocations[msg.sender] * INITIAL_UNLOCK_PERCENT) / 100;
        initialUnlockClaimed[msg.sender] = unlockAmount;
        totalClaimed[msg.sender] += unlockAmount;
        
        require(xgenToken.transfer(msg.sender, unlockAmount), "XGENVesting: transfer failed");
        emit InitialUnlockClaimed(msg.sender, unlockAmount);
    }
    
    /**
     * @dev Returns vested amount for a beneficiary
     * @param beneficiary Address of the beneficiary
     */
    function vestedAmount(address beneficiary) 
        public 
        view 
        returns (uint256) 
    {
        if (beneficiaryAllocations[beneficiary] == 0) return 0;
        
        uint256 totalAllocation = beneficiaryAllocations[beneficiary];
        uint256 vestingAllocation = (totalAllocation * (100 - INITIAL_UNLOCK_PERCENT)) / 100;
        
        if (block.timestamp < startTimestamp + CLIFF_DURATION) return 0;
        if (block.timestamp >= startTimestamp + VESTING_DURATION) return vestingAllocation;
        
        return (vestingAllocation * (block.timestamp - startTimestamp - CLIFF_DURATION)) / 
               (VESTING_DURATION - CLIFF_DURATION);
    }
    
    /**
     * @dev Claims vested tokens
     */
    function claimVested() 
        external 
        nonReentrant 
    {
        uint256 vested = vestedAmount(msg.sender);
        require(vested > 0, "XGENVesting: nothing to claim");
        
        uint256 claimable = vested - totalClaimed[msg.sender] + initialUnlockClaimed[msg.sender];
        require(claimable > 0, "XGENVesting: no tokens to claim");
        
        totalClaimed[msg.sender] += claimable;
        require(xgenToken.transfer(msg.sender, claimable), "XGENVesting: transfer failed");
        emit TokensClaimed(msg.sender, claimable);
    }
    
    /**
     * @dev Returns total allocation for a beneficiary
     */
    function getAllocation(address beneficiary) 
        external 
        view 
        returns (uint256) 
    {
        return beneficiaryAllocations[beneficiary];
    }
}