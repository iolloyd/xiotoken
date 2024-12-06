# XIO Integration Guide

## Overview

This guide details how to integrate with the XIO ecosystem, including token contracts, swap mechanisms, and auxiliary systems.

## Smart Contract Addresses

### Base Network
- XGEN Token: [TBD]
- Swap Contract: [TBD]

### Hyperliquid L1
- XIO Token: [TBD]

## Token Integration

### XGEN Token (Base)

```solidity
// IERC20 Interface
interface IXGEN {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// Example usage
contract XGENIntegration {
    IXGEN public constant XGEN = IXGEN(0x...); // Add contract address

    function checkBalance(address user) external view returns (uint256) {
        return XGEN.balanceOf(user);
    }
}
```

### XIO Token (Hyperliquid L1)

```solidity
interface IXIO {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function getBurnCapStatus() external view returns (uint256, uint256, uint256);
}
```

## Token Swap Integration

### Checking Swap Eligibility

```solidity
interface ITokenSwap {
    function canSwap(address user, uint256 amount) external view returns (bool);
    function swap(uint256 amount) external;
}

// Example implementation
contract SwapIntegration {
    ITokenSwap public constant SWAP = ITokenSwap(0x...); // Add contract address
    
    function performSwap(uint256 amount) external {
        require(SWAP.canSwap(msg.sender, amount), "Ineligible for swap");
        SWAP.swap(amount);
    }
}
```

## Web3 Integration (JavaScript)

### Setting Up

```javascript
import { ethers } from 'ethers';

// ABI definitions
const XGEN_ABI = [...]; // Add XGEN ABI
const XIO_ABI = [...];  // Add XIO ABI
const SWAP_ABI = [...]; // Add Swap ABI

// Contract instances
const xgenContract = new ethers.Contract(XGEN_ADDRESS, XGEN_ABI, provider);
const xioContract = new ethers.Contract(XIO_ADDRESS, XIO_ABI, provider);
const swapContract = new ethers.Contract(SWAP_ADDRESS, SWAP_ABI, provider);
```

### Example Functions

```javascript
// Check balances
async function getBalances(address) {
    const xgenBalance = await xgenContract.balanceOf(address);
    const xioBalance = await xioContract.balanceOf(address);
    return { xgen: xgenBalance, xio: xioBalance };
}

// Perform swap
async function performSwap(amount) {
    const tx = await swapContract.swap(amount);
    await tx.wait();
    return tx.hash;
}
```

## Technical Specifications

### Token Details

- **XGEN Token**
  - Network: Base
  - Decimals: 18
  - Total Supply: 1,000,000,000
  - Features: Pausable, Burnable

- **XIO Token**
  - Network: Hyperliquid L1
  - Decimals: 18
  - Total Supply: 1,000,000,000
  - Features: Pausable, Burnable, Quarterly Burns

### Gas Considerations

- Base Network Operations
  - Token Transfer: ~65,000 gas
  - Approve: ~45,000 gas
  - Swap: ~150,000 gas

- Hyperliquid L1 Operations
  - Token Transfer: [TBD]
  - Approve: [TBD]

## Security Guidelines

### Best Practices

1. Always verify contract addresses
2. Implement proper error handling
3. Use safe transfer methods
4. Check allowances before transfers
5. Monitor for paused state

### Error Handling

```javascript
try {
    await swapContract.swap(amount);
} catch (error) {
    if (error.message.includes("paused")) {
        // Handle paused contract
    } else if (error.message.includes("insufficient")) {
        // Handle insufficient balance/allowance
    } else {
        // Handle other errors
    }
}
```

## Event Monitoring

### Important Events

```solidity
// XGEN/XIO Events
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);

// Swap Events
event TokensSwapped(address indexed user, uint256 amount);
event SwapPaused();
event SwapUnpaused();
```

### Event Listening

```javascript
// Listen for swap events
swapContract.on("TokensSwapped", (user, amount, event) => {
    console.log(`Swap completed: ${amount} tokens by ${user}`);
});
```

## Testing

### Test Networks

- Base Testnet
  - XGEN Token: [TBD]
  - Swap Contract: [TBD]

- Hyperliquid Testnet
  - XIO Token: [TBD]

### Test Tokens

1. Base Testnet Faucet: [URL]
2. Test Guide: [Link to test guide]

## Support

- Technical Documentation: [URL]
- Developer Discord: [URL]
- Bug Reports: [GitHub Issues URL]
- Security Concerns: security@xioprotocol.io