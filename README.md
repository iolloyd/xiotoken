# XIO Token Implementation

This repository contains the smart contracts and deployment scripts for the XIO token ecosystem, including the XGEN placeholder token, XIO token, and token swap mechanism.

## Overview

The system consists of three main components:

1. **XGEN Token**: Initial placeholder token on Base network
2. **XIO Token**: Final token deployed on Hyperliquid L1
3. **TokenSwap**: Contract managing the 1:1 swap from XGEN to XIO

## Prerequisites

- Node.js v16+
- npm v8+
- Hardhat
- Access to Base network (RPC URL)
- Access to Hyperliquid L1 (RPC URL)
- Private key with sufficient ETH for deployment

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/xiotoken.git
cd xiotoken
```

2. Install dependencies:
```bash
npm install
```

3. Copy and configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your specific configuration:
```env
# Network Configuration
BASE_RPC_URL=your_base_rpc_url
BASESCAN_API_KEY=your_basescan_api_key

# Deployment Account
PRIVATE_KEY=your_private_key
DEPLOYER_ADDRESS=your_deployer_address

# Contract Configuration
TOTAL_SUPPLY=100000000
SEED_ROUND_ALLOCATION=10000000
TOKEN_PRICE=100000000
MIN_INVESTMENT=1000
MAX_INVESTMENT=50000

# Security Configuration
MULTISIG_ADDRESS=your_multisig_address
ADMIN_ADDRESSES=address1,address2,address3
PAUSER_ADDRESSES=address1,address2
MINTER_ADDRESSES=address1,address2

# Sale Configuration
SALE_START_TIME=unix_timestamp
SALE_DURATION=129600
INITIAL_UNLOCK_PERCENT=10
CLIFF_PERIOD=15552000
VESTING_DURATION=46656000

# Rate Limiting
RATE_LIMIT_AMOUNT=100000
RATE_LIMIT_PERIOD=3600
```

## Testing

Run the test suite:
```bash
npm test
```

For coverage report:
```bash
npm run coverage
```

## Deployment

### 1. Deploy XGEN Token (Base Network)
```bash
npm run deploy:xgen:base
```

### 2. Run Token Sale
Configure sale parameters in Fjord Foundry and start the sale.

### 3. Deploy Token Swap
```bash
npm run deploy:swap:base
```

### 4. Deploy XIO Token (Hyperliquid L1)
```bash
npm run deploy:xio:hyperliquid
```

## Contract Verification

Verify contracts on respective block explorers:
```bash
# Verify on Base
npm run verify:base CONTRACT_ADDRESS CONSTRUCTOR_ARGS

# Verify on Hyperliquid
npm run verify:hyperliquid CONTRACT_ADDRESS CONSTRUCTOR_ARGS
```

## Security

The contracts implement several security features:

1. **Role-Based Access Control**
   - Admin roles
   - Pauser roles
   - Minter roles
   - Operator roles
   - Governance roles

2. **Rate Limiting**
   - Configurable transfer limits
   - Time-based restrictions
   - Exemption list for trusted addresses

3. **Emergency Controls**
   - Pause functionality
   - Emergency recovery system
   - Time-locked emergency actions

4. **Burn Mechanism**
   - Quarterly burn schedule
   - Maximum burn cap
   - Profit-based burn calculation

## Documentation

Additional documentation:
- [Implementation Plan](./docs/XIO%20Token%20Implementation%20Plan.md)
- [Security Documentation](./docs/XIO%20Token%20Security%20Documentation.md)
- [Technical Documentation](./docs/XIO%20Token%20Implementation%20Documentation.md)

## Scripts

Available npm scripts:
```bash
npm run compile      # Compile contracts
npm run test        # Run tests
npm run coverage    # Generate coverage report
npm run deploy:base # Deploy to Base network
npm run verify      # Verify contracts
npm run clean       # Clean build files
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on the development process.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
