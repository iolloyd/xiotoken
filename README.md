# XGEN Token

XGEN is a placeholder token for the XIO ecosystem, designed to be swapped 1:1 for the XIO utility token on Base network.

## Security Features

- Role-based access control with time-locked role changes
- Identity-based rate limiting
- Suspicious activity detection
- Comprehensive event logging
- Emergency pause functionality
- Whitelist system

## Project Structure

```
├── contracts/
│   ├── interfaces/         # Contract interfaces
│   ├── XGEN.sol           # Main token contract
│   ├── XGENSale.sol       # Token sale contract
│   └── XGENVesting.sol    # Vesting schedule management
├── scripts/
│   └── deploy.js          # Deployment script
├── test/                  # Test files
├── .env                   # Environment configuration
└── hardhat.config.js      # Hardhat configuration
```

## Prerequisites

- Node.js >= 14.0.0
- Yarn or npm

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd xiotoken
```

2. Install dependencies:
```bash
yarn install
```

3. Copy the environment file and fill in your values:
```bash
cp .env.example .env
```

Required environment variables:
- `PRIVATE_KEY`: Your deployment wallet's private key
- `BASESCAN_API_KEY`: API key from BaseScan
- `BASE_MAINNET_RPC_URL`: Base mainnet RPC URL
- `BASE_GOERLI_RPC_URL`: Base Goerli RPC URL
- `ADMIN_ADDRESS`: Admin role address
- `PAUSER_ADDRESS`: Pauser role address
- `MINTER_ADDRESS`: Minter role address
- `CONFIGURATOR_ADDRESS`: Configurator role address

## Testing

Run the test suite:
```bash
yarn test
```

Generate coverage report:
```bash
yarn test:coverage
```

## Deployment

### Base Goerli (Testnet)

1. Ensure your `.env` file is configured with Base Goerli settings
2. Deploy:
```bash
yarn deploy:base-goerli
```

### Base Mainnet

1. Ensure your `.env` file is configured with Base mainnet settings
2. Deploy:
```bash
yarn deploy:base
```

## Contract Verification

Contracts will be automatically verified on BaseScan after deployment. If verification fails, you can retry manually:
```bash
yarn verify:contracts
```

## Security

The project has undergone a security audit, with findings and fixes documented in `AUDIT_REPORT.md`. Key security features include:

1. **Role Management**:
   - Separate roles for different responsibilities
   - Time-locked role changes
   - Multi-step role transfer process

2. **Rate Limiting**:
   - Identity-based limits
   - Transfer pattern detection
   - Rolling time windows

3. **Access Control**:
   - Whitelist system
   - Pausable transfers
   - Emergency controls

## Available Scripts

- `yarn compile`: Compile contracts
- `yarn test`: Run tests
- `yarn test:coverage`: Generate coverage report
- `yarn deploy:base`: Deploy to Base mainnet
- `yarn deploy:base-goerli`: Deploy to Base Goerli
- `yarn verify:contracts`: Verify contracts on BaseScan
- `yarn lint`: Run Solidity linter
- `yarn lint:fix`: Fix linting issues
- `yarn format`: Format Solidity code

## Contributing

Please read `CONTRIBUTING.md` for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
