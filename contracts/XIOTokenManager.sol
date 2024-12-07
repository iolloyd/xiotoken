// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title XIOTokenManager
 * @notice Manages DAO token operations and integrates with Mangna
 */
contract XIOTokenManager is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    IERC20 public immutable xioToken;
    
    // Treasury management
    uint256 public constant TRANSFER_DELAY = 1 days;
    mapping(bytes32 => TransferRequest) public pendingTransfers;
    
    // Operation tracking
    mapping(address => uint256) public operatorLimits;
    mapping(address => uint256) public dailyOperations;
    mapping(address => uint256) public lastOperationTimestamp;
    
    struct TransferRequest {
        address recipient;
        uint256 amount;
        uint256 executionTime;
        bool executed;
        string purpose;
    }
    
    // Events
    event TransferRequested(
        bytes32 indexed requestId,
        address indexed recipient,
        uint256 amount,
        uint256 executionTime
    );
    event TransferExecuted(
        bytes32 indexed requestId,
        address indexed recipient,
        uint256 amount
    );
    event OperatorLimitUpdated(
        address indexed operator,
        uint256 oldLimit,
        uint256 newLimit
    );
    
    /**
     * @dev Constructor
     * @param _token XIO token address
     */
    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        
        xioToken = IERC20(_token);
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);
        _setupRole(TREASURY_ROLE, msg.sender);
    }
    
    /**
     * @dev Requests a token transfer
     * @param recipient Recipient address
     * @param amount Transfer amount
     * @param purpose Transfer purpose
     */
    function requestTransfer(
        address recipient,
        uint256 amount,
        string memory purpose
    )
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        returns (bytes32)
    {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(amount <= operatorLimits[msg.sender], "Exceeds limit");
        
        bytes32 requestId = keccak256(
            abi.encodePacked(
                recipient,
                amount,
                block.timestamp,
                msg.sender
            )
        );
        
        uint256 executionTime = block.timestamp + TRANSFER_DELAY;
        
        pendingTransfers[requestId] = TransferRequest({
            recipient: recipient,
            amount: amount,
            executionTime: executionTime,
            executed: false,
            purpose: purpose
        });
        
        emit TransferRequested(requestId, recipient, amount, executionTime);
        
        return requestId;
    }
    
    /**
     * @dev Executes a pending transfer
     * @param requestId Transfer request ID
     */
    function executeTransfer(bytes32 requestId)
        external
        nonReentrant
        onlyRole(TREASURY_ROLE)
        whenNotPaused
    {
        TransferRequest storage request = pendingTransfers[requestId];
        
        require(!request.executed, "Already executed");
        require(
            block.timestamp >= request.executionTime,
            "Too early"
        );
        
        request.executed = true;
        
        require(
            xioToken.transfer(request.recipient, request.amount),
            "Transfer failed"
        );
        
        emit TransferExecuted(requestId, request.recipient, request.amount);
    }
    
    /**
     * @dev Updates operator limits
     * @param operator Operator address
     * @param newLimit New operation limit
     */
    function updateOperatorLimit(address operator, uint256 newLimit)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(operator != address(0), "Invalid operator");
        
        uint256 oldLimit = operatorLimits[operator];
        operatorLimits[operator] = newLimit;
        
        emit OperatorLimitUpdated(operator, oldLimit, newLimit);
    }
}