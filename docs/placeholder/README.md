# Placeholder Token Documentation

## Overview
The Placeholder Token is a simplified ERC20 implementation designed for testing on Fjord Foundry. It includes essential security features while remaining simple enough for testing purposes.

## Features
- ERC20 standard compliance
- Access control with roles (Admin, Minter, Pauser)
- Pausable functionality
- Permit support for gasless approvals
- Reentrancy protection
- Initial supply of 1 million tokens

## Contract Details
- Name: Placeholder Token
- Symbol: PLACE
- Decimals: 18
- Initial Supply: 1,000,000 tokens

## Roles
1. DEFAULT_ADMIN_ROLE: Can grant/revoke other roles
2. PAUSER_ROLE: Can pause/unpause token transfers
3. MINTER_ROLE: Can mint new tokens

## Setup Instructions

### Prerequisites
1. Install dependencies:
```bash
npm install
```

2. Configure environment:
Create a `.env` file with:
```
PRIVATE_KEY=your_private_key
FJORD_RPC_URL=your_fjord_rpc_url
```

### Deployment
1. Deploy to Fjord Foundry:
```bash
npx hardhat run scripts/placeholder/deploy.js --network fjord
```

2. Verify contract (if supported):
```bash
npx hardhat verify --network fjord DEPLOYED_CONTRACT_ADDRESS
```

## Usage

### Token Management
```javascript
// Mint new tokens (requires MINTER_ROLE)
await token.mint(recipient, amount);

// Pause token transfers (requires PAUSER_ROLE)
await token.pause();

// Unpause token transfers (requires PAUSER_ROLE)
await token.unpause();
```

### Role Management
```javascript
// Grant role (requires DEFAULT_ADMIN_ROLE)
await token.grantRole(ROLE, address);

// Revoke role (requires DEFAULT_ADMIN_ROLE)
await token.revokeRole(ROLE, address);
```

### Standard ERC20 Operations
```javascript
// Transfer tokens
await token.transfer(recipient, amount);

// Approve spender
await token.approve(spender, amount);

// Transfer from approved amount
await token.transferFrom(sender, recipient, amount);
```

## Security Considerations
1. Access Control: All privileged operations are protected by roles
2. Pausability: Token transfers can be paused in case of emergencies
3. Reentrancy: Protected against reentrancy attacks
4. Permit: Supports gasless approvals

## Development

### Testing
Run tests:
```bash
npx hardhat test
```

### Local Development
Run local node:
```bash
npx hardhat node
```

Deploy locally:
```bash
npx hardhat run scripts/placeholder/deploy.js --network localhost
```

## Contract Interactions on Fjord Foundry

### Using Hardhat Console
```javascript
// Attach to deployed contract
const token = await ethers.getContractAt("PlaceholderToken", "DEPLOYED_ADDRESS");

// Check balance
const balance = await token.balanceOf(address);
```

### Using Web3.js
```javascript
const web3 = new Web3(fjordProvider);
const token = new web3.eth.Contract(PlaceholderToken.abi, "DEPLOYED_ADDRESS");
```

## Troubleshooting
1. Deployment fails: Ensure correct RPC URL and sufficient funds
2. Transaction reverts: Check role permissions
3. Verification fails: Ensure correct network and constructor arguments