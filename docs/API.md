# API Documentation

## XIO Token Contract

### Core ERC20 Functions

#### transfer
```solidity
function transfer(address to, uint256 amount) public returns (bool)
```
Transfer tokens with rate limiting.
- **Parameters:**
  - `to`: Recipient address
  - `amount`: Amount of tokens
- **Returns:** Success boolean
- **Reverts:** If rate limit exceeded

#### transferFrom
```solidity
function transferFrom(address from, address to, uint256 amount) public returns (bool)
```
Transfer tokens on behalf of another address.
- **Parameters:**
  - `from`: Source address
  - `to`: Recipient address
  - `amount`: Amount of tokens
- **Returns:** Success boolean
- **Reverts:** If rate limit exceeded or insufficient allowance

### Rate Limiting Functions

#### updateRateLimit
```solidity
function updateRateLimit(uint256 _amount, uint256 _period) external onlyRole(OPERATOR_ROLE)
```
Update rate limit parameters.
- **Parameters:**
  - `_amount`: New rate limit amount
  - `_period`: New rate limit period in seconds
- **Access:** OPERATOR_ROLE
- **Emits:** RateLimitUpdated

#### updateRateLimitExemption
```solidity
function updateRateLimitExemption(address account, bool status) external onlyRole(OPERATOR_ROLE)
```
Update rate limit exemption status.
- **Parameters:**
  - `account`: Address to update
  - `status`: New exemption status
- **Access:** OPERATOR_ROLE
- **Emits:** RateLimitExemptionUpdated

### Burn Functions

#### executeQuarterlyBurn
```solidity
function executeQuarterlyBurn(uint256 amount) external onlyRole(BURNER_ROLE) nonReentrant
```
Execute quarterly token burn.
- **Parameters:**
  - `amount`: Amount to burn
- **Access:** BURNER_ROLE
- **Reverts:** If too early or exceeds limit
- **Emits:** TokensBurned, QuarterlyBurnExecuted

### Emergency Functions

#### initiateEmergencyMode
```solidity
function initiateEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE)
```
Activate emergency mode.
- **Access:** DEFAULT_ADMIN_ROLE
- **Emits:** EmergencyModeActivated

#### updateEmergencyRecovery
```solidity
function updateEmergencyRecovery(address newAddress) external onlyRole(DEFAULT_ADMIN_ROLE)
```
Update emergency recovery address.
- **Parameters:**
  - `newAddress`: New recovery address
- **Access:** DEFAULT_ADMIN_ROLE
- **Emits:** EmergencyRecoveryAddressUpdated

### View Functions

#### getBurnStats
```solidity
function getBurnStats() external view returns (
    uint256 totalBurnt,
    uint256 remainingToBurn,
    uint256 maxBurnCap,
    uint256 nextBurnAllowed
)
```
Get burn statistics.
- **Returns:**
  - Total amount burnt
  - Remaining burn allowance
  - Maximum burn cap
  - Timestamp for next allowed burn

#### getRateLimitStatus
```solidity
function getRateLimitStatus(address account) external view returns (
    uint256 currentPeriodTransfers,
    uint256 remainingInPeriod,
    uint256 periodResetTime
)
```
Get rate limit status for an address.
- **Parameters:**
  - `account`: Address to check
- **Returns:**
  - Current period transfer total
  - Remaining transfer allowance
  - Period reset timestamp

## Governance Contract

### Proposal Management

#### scheduleProposal
```solidity
function scheduleProposal(
    bytes32 proposalId,
    bytes[] memory signatures
) external onlyRole(PROPOSER_ROLE)
```
Schedule a new proposal.
- **Parameters:**
  - `proposalId`: Unique proposal identifier
  - `signatures`: Required signatures
- **Access:** PROPOSER_ROLE
- **Emits:** ProposalScheduled

#### executeProposal
```solidity
function executeProposal(
    bytes32 proposalId,
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas
) external nonReentrant onlyRole(EXECUTOR_ROLE)
```
Execute a scheduled proposal.
- **Parameters:**
  - `proposalId`: Proposal to execute
  - `targets`: Target contract addresses
  - `values`: ETH values for calls
  - `calldatas`: Encoded function calls
- **Access:** EXECUTOR_ROLE
- **Emits:** ProposalExecuted

### Emergency Actions

#### executeEmergencyAction
```solidity
function executeEmergencyAction(
    bytes32 proposalId,
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory reason
) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE)
```
Execute emergency action.
- **Parameters:**
  - `proposalId`: Action identifier
  - `targets`: Target contract addresses
  - `values`: ETH values for calls
  - `calldatas`: Encoded function calls
  - `reason`: Reason for emergency action
- **Access:** DEFAULT_ADMIN_ROLE
- **Emits:** EmergencyActionExecuted

### Parameter Management

#### updateGovernanceParameters
```solidity
function updateGovernanceParameters(
    uint256 _quorum,
    uint256 _proposalThreshold
) external onlyRole(DEFAULT_ADMIN_ROLE)
```
Update governance parameters.
- **Parameters:**
  - `_quorum`: New quorum threshold
  - `_proposalThreshold`: New proposal threshold
- **Access:** DEFAULT_ADMIN_ROLE
- **Emits:** GovernanceParametersUpdated

### View Functions

#### canPropose
```solidity
function canPropose(address account) external view returns (bool)
```
Check if an address can create proposals.
- **Parameters:**
  - `account`: Address to check
- **Returns:** Boolean indicating eligibility

## Events

### XIO Token Events
```solidity
event TokensBurned(uint256 amount, uint256 totalBurned, uint256 timestamp)
event QuarterlyBurnExecuted(uint256 amount, uint256 quarter, uint256 year)
event RateLimitUpdated(uint256 amount, uint256 period)
event RateLimitExemptionUpdated(address indexed account, bool status)
event EmergencyModeActivated(uint256 timestamp)
event EmergencyRecoveryAddressUpdated(address indexed oldAddress, address indexed newAddress)
event TransferLimitExceeded(address indexed from, address indexed to, uint256 amount, uint256 limit)
```

### Governance Events
```solidity
event ProposalScheduled(bytes32 indexed proposalId, uint256 executionTime)
event ProposalExecuted(bytes32 indexed proposalId, address indexed executor)
event GovernanceParametersUpdated(uint256 quorum, uint256 threshold)
event EmergencyActionExecuted(bytes32 indexed proposalId, string reason)
```

## Integration Examples

### Web3 Integration
```javascript
// Connect to contract
const xio = new web3.eth.Contract(XIO_ABI, XIO_ADDRESS);

// Transfer tokens
await xio.methods.transfer(recipient, amount).send({
  from: sender,
  gas: 200000
});

// Check rate limit status
const status = await xio.methods.getRateLimitStatus(account).call();

// Monitor events
xio.events.TokensBurned({}, (error, event) => {
  console.log('Burn executed:', event.returnValues);
});
```

### Ethers.js Integration
```javascript
// Connect to contract
const xio = new ethers.Contract(XIO_ADDRESS, XIO_ABI, signer);

// Execute burn
await xio.executeQuarterlyBurn(burnAmount);

// Listen for events
xio.on("TransferLimitExceeded", (from, to, amount, limit) => {
  console.log('Rate limit exceeded:', {from, to, amount, limit});
});
```