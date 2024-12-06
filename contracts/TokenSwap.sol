// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TokenSwap
 * @notice Manages the swap between XGEN and XIO tokens
 * @dev Implements security features including pausable, access control, and reentrancy protection
 */
contract TokenSwap is Pausable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable xgenToken;
    IERC20 public immutable xioToken;
    
    uint256 public immutable swapStartTime;
    uint256 public immutable swapEndTime;
    uint256 public constant SWAP_RATIO = 1;
    
    // Rate limiting
    uint256 public rateLimitAmount;
    uint256 public rateLimitPeriod;
    mapping(address => uint256) public lastSwapTimestamp;
    mapping(address => uint256) public swappedInPeriod;
    
    // Emergency recovery
    address public emergencyRecoveryAddress;
    bool public emergencyMode;
    uint256 public constant EMERGENCY_DELAY = 24 hours;
    uint256 public emergencyActionTimestamp;
    
    // Events
    event TokensSwapped(
        address indexed user,
        uint256 xgenAmount,
        uint256 xioAmount,
        uint256 timestamp
    );
    event RateLimitUpdated(uint256 amount, uint256 period);
    event EmergencyModeActivated(uint256 timestamp);
    event EmergencyWithdrawal(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    event BatchSwapCompleted(
        address indexed user,
        uint256 totalXgenAmount,
        uint256 totalXioAmount
    );
    event SwapTimeUpdated(uint256 startTime, uint256 endTime);
    event EmergencyRecoveryAddressUpdated(
        address indexed oldAddress,
        address indexed newAddress
    );

    /**
     * @dev Modifier to check if swap window is active
     */
    modifier whenSwapActive() {
        require(block.timestamp >= swapStartTime, "TokenSwap: Swap not started");
        require(block.timestamp <= swapEndTime, "TokenSwap: Swap ended");
        _;
    }

    /**
     * @dev Constructor to initialize the swap contract
     * @param _xgenToken Address of the XGEN token contract
     * @param _xioToken Address of the XIO token contract
     * @param _swapStartTime Timestamp when swaps can begin
     * @param _swapDuration Duration of the swap window in seconds
     * @param _rateLimitAmount Maximum amount that can be swapped in a period
     * @param _rateLimitPeriod Duration of the rate limit period in seconds
     * @param _emergencyRecovery Address for emergency token recovery
     */
    constructor(
        address _xgenToken,
        address _xioToken,
        uint256 _swapStartTime,
        uint256 _swapDuration,
        uint256 _rateLimitAmount,
        uint256 _rateLimitPeriod,
        address _emergencyRecovery
    ) {
        require(_xgenToken != address(0), "TokenSwap: XGEN address cannot be zero");
        require(_xioToken != address(0), "TokenSwap: XIO address cannot be zero");
        require(_swapStartTime > block.timestamp, "TokenSwap: Start must be future");
        require(_swapDuration > 0, "TokenSwap: Duration must be positive");
        require(_rateLimitAmount > 0, "TokenSwap: Rate limit must be positive");
        require(_rateLimitPeriod > 0, "TokenSwap: Period must be positive");
        require(_emergencyRecovery != address(0), "TokenSwap: Recovery cannot be zero");

        xgenToken = IERC20(_xgenToken);
        xioToken = IERC20(_xioToken);
        swapStartTime = _swapStartTime;
        swapEndTime = _swapStartTime + _swapDuration;
        rateLimitAmount = _rateLimitAmount;
        rateLimitPeriod = _rateLimitPeriod;
        emergencyRecoveryAddress = _emergencyRecovery;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    /**
     * @notice Swaps XGEN tokens for XIO tokens
     * @param amount Amount of XGEN tokens to swap
     */
    function swap(uint256 amount) external nonReentrant whenNotPaused whenSwapActive {
        require(amount > 0, "TokenSwap: Amount must be positive");
        _checkAndUpdateRateLimit(msg.sender, amount);
        
        uint256 xioAmount = amount * SWAP_RATIO;
        require(
            xioToken.balanceOf(address(this)) >= xioAmount,
            "TokenSwap: Insufficient XIO balance"
        );

        xgenToken.safeTransferFrom(msg.sender, address(this), amount);
        xioToken.safeTransfer(msg.sender, xioAmount);

        emit TokensSwapped(msg.sender, amount, xioAmount, block.timestamp);
    }

    /**
     * @notice Performs multiple swaps in a single transaction
     * @param amounts Array of amounts to swap
     */
    function batchSwap(uint256[] calldata amounts) 
        external 
        nonReentrant 
        whenNotPaused 
        whenSwapActive 
    {
        require(amounts.length > 0, "TokenSwap: Empty amounts array");
        
        uint256 totalXgenAmount = 0;
        uint256 totalXioAmount = 0;
        
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "TokenSwap: Amount must be positive");
            totalXgenAmount += amounts[i];
            totalXioAmount += amounts[i] * SWAP_RATIO;
        }
        
        _checkAndUpdateRateLimit(msg.sender, totalXgenAmount);
        
        require(
            xioToken.balanceOf(address(this)) >= totalXioAmount,
            "TokenSwap: Insufficient XIO balance"
        );

        xgenToken.safeTransferFrom(msg.sender, address(this), totalXgenAmount);
        xioToken.safeTransfer(msg.sender, totalXioAmount);

        emit BatchSwapCompleted(msg.sender, totalXgenAmount, totalXioAmount);
    }

    /**
     * @dev Updates rate limit parameters
     * @param _amount New rate limit amount
     * @param _period New rate limit period
     */
    function updateRateLimit(uint256 _amount, uint256 _period)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(_amount > 0, "TokenSwap: Invalid rate limit amount");
        require(_period > 0, "TokenSwap: Invalid rate limit period");
        
        rateLimitAmount = _amount;
        rateLimitPeriod = _period;
        
        emit RateLimitUpdated(_amount, _period);
    }

    /**
     * @notice Updates the emergency recovery address
     * @param newAddress New recovery address
     */
    function updateEmergencyRecovery(address newAddress)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newAddress != address(0), "TokenSwap: Invalid address");
        address oldAddress = emergencyRecoveryAddress;
        emergencyRecoveryAddress = newAddress;
        emit EmergencyRecoveryAddressUpdated(oldAddress, newAddress);
    }

    /**
     * @notice Initiates emergency mode
     */
    function initiateEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!emergencyMode, "TokenSwap: Already in emergency mode");
        emergencyMode = true;
        emergencyActionTimestamp = block.timestamp + EMERGENCY_DELAY;
        emit EmergencyModeActivated(block.timestamp);
    }

    /**
     * @notice Executes emergency withdrawal
     * @param token Token to withdraw
     */
    function emergencyWithdraw(IERC20 token) external {
        require(emergencyMode, "TokenSwap: Not in emergency mode");
        require(
            block.timestamp >= emergencyActionTimestamp,
            "TokenSwap: Emergency delay not passed"
        );
        require(
            msg.sender == emergencyRecoveryAddress,
            "TokenSwap: Not recovery address"
        );

        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.safeTransfer(emergencyRecoveryAddress, balance);
            emit EmergencyWithdrawal(
                address(token),
                emergencyRecoveryAddress,
                balance
            );
        }
    }

    /**
     * @dev Checks and updates rate limit for an account
     * @param account Address to check
     * @param amount Amount being swapped
     */
    function _checkAndUpdateRateLimit(address account, uint256 amount) internal {
        if (block.timestamp >= lastSwapTimestamp[account] + rateLimitPeriod) {
            swappedInPeriod[account] = 0;
            lastSwapTimestamp[account] = block.timestamp;
        }
        
        require(
            swappedInPeriod[account] + amount <= rateLimitAmount,
            "TokenSwap: Rate limit exceeded"
        );
        
        swappedInPeriod[account] += amount;
    }

    /**
     * @notice Pauses all swap operations
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses all swap operations
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}