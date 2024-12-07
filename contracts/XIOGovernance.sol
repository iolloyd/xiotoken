// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title XIOGovernance
 * @notice Handles governance integration with Snapshot and proposal execution
 */
contract XIOGovernance is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    
    // Snapshot integration
    mapping(bytes32 => bool) public proposalExecuted;
    mapping(bytes32 => uint256) public proposalDeadlines;
    uint256 public constant EXECUTION_DELAY = 2 days;
    uint256 public constant EXECUTION_WINDOW = 5 days;
    
    // Governance parameters
    uint256 public quorumThreshold;
    uint256 public proposalThreshold;
    IERC20 public immutable xioToken;
    
    // Events
    event ProposalScheduled(bytes32 indexed proposalId, uint256 executionTime);
    event ProposalExecuted(bytes32 indexed proposalId, address indexed executor);
    event GovernanceParametersUpdated(uint256 quorum, uint256 threshold);
    event EmergencyActionExecuted(bytes32 indexed proposalId, string reason);
    
    /**
     * @dev Constructor
     * @param _token XIO token address
     * @param _quorum Initial quorum threshold
     * @param _proposalThreshold Initial proposal threshold
     */
    constructor(
        address _token,
        uint256 _quorum,
        uint256 _proposalThreshold
    ) {
        require(_token != address(0), "Invalid token address");
        require(_quorum > 0, "Invalid quorum");
        require(_proposalThreshold > 0, "Invalid threshold");
        
        xioToken = IERC20(_token);
        quorumThreshold = _quorum;
        proposalThreshold = _proposalThreshold;
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(EXECUTOR_ROLE, msg.sender);
        _setupRole(PROPOSER_ROLE, msg.sender);
    }
    
    /**
     * @dev Schedules a proposal for execution
     * @param proposalId Snapshot proposal ID
     * @param signatures Required signatures
     */
    function scheduleProposal(
        bytes32 proposalId,
        bytes[] memory signatures
    )
        external
        onlyRole(PROPOSER_ROLE)
    {
        require(!proposalExecuted[proposalId], "Already executed");
        require(signatures.length >= 3, "Insufficient signatures"); // Minimum 3 signatures
        
        // Verify signatures (implementation depends on Snapshot specifics)
        // This is a placeholder for actual signature verification
        
        uint256 executionTime = block.timestamp + EXECUTION_DELAY;
        proposalDeadlines[proposalId] = executionTime + EXECUTION_WINDOW;
        
        emit ProposalScheduled(proposalId, executionTime);
    }
    
    /**
     * @dev Executes a scheduled proposal
     * @param proposalId Snapshot proposal ID
     * @param targets Target addresses for calls
     * @param values ETH values for calls
     * @param calldatas Call data for each target
     */
    function executeProposal(
        bytes32 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    )
        external
        nonReentrant
        onlyRole(EXECUTOR_ROLE)
    {
        require(!proposalExecuted[proposalId], "Already executed");
        require(
            block.timestamp >= proposalDeadlines[proposalId] - EXECUTION_WINDOW,
            "Too early"
        );
        require(block.timestamp <= proposalDeadlines[proposalId], "Too late");
        require(
            targets.length == values.length &&
            values.length == calldatas.length,
            "Length mismatch"
        );
        
        proposalExecuted[proposalId] = true;
        
        // Execute each call
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(calldatas[i]);
            require(success, "Call failed");
        }
        
        emit ProposalExecuted(proposalId, msg.sender);
    }
    
    /**
     * @dev Updates governance parameters
     * @param _quorum New quorum threshold
     * @param _proposalThreshold New proposal threshold
     */
    function updateGovernanceParameters(
        uint256 _quorum,
        uint256 _proposalThreshold
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_quorum > 0, "Invalid quorum");
        require(_proposalThreshold > 0, "Invalid threshold");
        
        quorumThreshold = _quorum;
        proposalThreshold = _proposalThreshold;
        
        emit GovernanceParametersUpdated(_quorum, _proposalThreshold);
    }
    
    /**
     * @dev Emergency execution of critical actions
     * @param proposalId Emergency proposal ID
     * @param targets Target addresses
     * @param values ETH values
     * @param calldatas Call data
     * @param reason Emergency reason
     */
    function executeEmergencyAction(
        bytes32 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory reason
    )
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            targets.length == values.length &&
            values.length == calldatas.length,
            "Length mismatch"
        );
        
        // Execute emergency actions
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(calldatas[i]);
            require(success, "Call failed");
        }
        
        emit EmergencyActionExecuted(proposalId, reason);
    }
    
    /**
     * @dev View function to check if an address can propose
     * @param account Address to check
     */
    function canPropose(address account) external view returns (bool) {
        return xioToken.balanceOf(account) >= proposalThreshold;
    }
    
    /**
     * @dev Receive function to allow receiving ETH
     */
    receive() external payable {}
}