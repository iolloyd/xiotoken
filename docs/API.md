# API Reference

## Smart Contract Interfaces

### XGEN Token

#### Core ERC-20 Functions

```solidity
function transfer(address to, uint256 amount) public returns (bool)
function approve(address spender, uint256 amount) public returns (bool)
function transferFrom(address from, address to, uint256 amount) public returns (bool)
function balanceOf(address account) public view returns (uint256)
function allowance(address owner, address spender) public view returns (uint256)
```

#### Administrative Functions

```solidity
function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE)
function burn(uint256 amount) public
function pause() public onlyRole(PAUSER_ROLE)
function unpause() public onlyRole(PAUSER_ROLE)
```

### XIO Token

[Same interface as XGEN Token]

### Token Swap

#### User Functions

```solidity
function swap(uint256 amount) external nonReentrant whenNotPaused
```

#### Administrative Functions

```solidity
function pause() external onlyRole(PAUSER_ROLE)
function unpause() external onlyRole(PAUSER_ROLE)
function withdrawXIO(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE)
function withdrawXGEN(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE)
```

## Events

### XGEN & XIO Tokens

```solidity
event Transfer(address indexed from, address indexed to, uint256 value)
event Approval(address indexed owner, address indexed spender, uint256 value)
event Paused(address account)
event Unpaused(address account)
```

### Token Swap

```solidity
event TokensSwapped(address indexed user, uint256 amount)
```

## Error Codes

### XGEN & XIO Tokens

- `ERC20InsufficientBalance`
- `ERC20InsufficientAllowance`
- `ERC20InvalidSender`
- `ERC20InvalidReceiver`
- `AccessControlUnauthorizedAccount`
- `EnforcedPause`
- `ExpectedPause`

### Token Swap

- `SwapNotStarted`
- `InsufficientBalance`
- `TransferFailed`
- `InvalidAmount`

## Using the Contracts

### JavaScript/TypeScript Integration

```javascript
// Example using ethers.js
const XGEN = await ethers.getContractFactory("XGEN");
const xgen = XGEN.attach("DEPLOYED_ADDRESS");

// Approve tokens for swap
await xgen.approve(swapAddress, amount);

// Perform swap
const swap = await ethers.getContractAt("TokenSwap", swapAddress);
await swap.swap(amount);
```

### Web3.js Integration

```javascript
// Example using Web3
const xgen = new web3.eth.Contract(XGEN_ABI, XGEN_ADDRESS);
const swap = new web3.eth.Contract(SWAP_ABI, SWAP_ADDRESS);

// Approve tokens for swap
await xgen.methods.approve(swapAddress, amount).send({from: userAddress});

// Perform swap
await swap.methods.swap(amount).send({from: userAddress});
```

## Rate Limiting and Security

- Maximum transaction size: Unlimited
- Rate limiting: None
- Pause mechanism: Available for emergency situations
- Role requirements: Specific roles needed for administrative functions

## Best Practices

1. Always check return values from transactions
2. Implement proper error handling
3. Use the latest version of the contracts
4. Monitor events for transaction confirmation
5. Implement proper gas estimation
6. Handle network congestion appropriately

## Integration Guidelines

1. Always use the official contract addresses
2. Implement proper error handling
3. Monitor for paused state
4. Validate transaction success
5. Maintain proper role management
6. Follow security best practices