# XIO Token Implementation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The XIO Token Implementation is a comprehensive dual-network token system featuring:
- A placeholder token ($XGEN) on Base network for the initial sale
- The final token ($XIO) on Hyperliquid L1
- A secure token swap mechanism
- Advanced governance and treasury management capabilities

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Features

### Token Implementation
- ERC-20 compliant smart contracts
- Role-based access control
- Pausable functionality
- Burnable tokens
- Emergency controls

### Token Sale (Fjord Foundry)
- Customizable sale parameters
- Whitelisting capabilities
- Investment limits
- Vesting schedule support
- Technical documentation for investors

### Token Swap
- 1:1 swap ratio ($XGEN to $XIO)
- Time-locked activation
- Emergency pause functionality
- Administrative controls
- Secure withdrawal mechanisms

### Governance & Management
- Snapshot.org integration
- Multi-signature wallet implementation
- DAO management tools (Mangna)
- Treasury controls
- Proposal management system

## Architecture

The project consists of three main smart contracts:

1. **XGEN Token** (Base Network)
   - Placeholder token for initial sale
   - Full ERC-20 functionality
   - Administrative controls

2. **XIO Token** (Hyperliquid L1)
   - Final token implementation
   - Enhanced L1 capabilities
   - Governance integration

3. **Token Swap**
   - Secure exchange mechanism
   - Rate control
   - Administrative features

Detailed architecture documentation is available in [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git
- Access to Base and Hyperliquid networks
- Private key with sufficient funds for deployment

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/xiotoken.git
cd xiotoken
```

2. Install dependencies:
```bash
make install
```

3. Configure environment:
```bash
make setup
```

4. Build and test:
```bash
make compile
make test
```

## Development

### Environment Setup

Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Required environment variables:
- `PRIVATE_KEY`: Your deployment wallet private key
- `BASE_RPC_URL`: Base network RPC URL
- `HYPERLIQUID_RPC_URL`: Hyperliquid network RPC URL
- `ETHERSCAN_API_KEY`: For contract verification

### Build

```bash
make compile
```

### Code Style

Format code:
```bash
make format
```

Lint code:
```bash
make lint
```

## Testing

Run the test suite:
```bash
make test
```

Generate coverage report:
```bash
make coverage
```

## Deployment

### Base Network (XGEN)
```bash
make deploy-base
```

### Hyperliquid L1 (XIO)
```bash
make deploy-hyperliquid
```

### Token Swap Contract
```bash
make deploy-swap
```

### Verify All Contracts
```bash
make verify-all
```

Detailed deployment instructions are available in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Security

### Smart Contract Security

- Role-based access control
- Emergency pause functionality
- Rate limiting mechanisms
- Reentrancy protection
- Multi-signature requirements
- Time-locked operations

### Audit Status

[Add audit information when available]

### Bug Bounty

[Add bug bounty information when available]

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [API Reference](docs/API.md)
- [Security Model](docs/SECURITY.md)

## Contributing

We welcome contributions to the XIO Token Implementation! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

### Code Style

- Solidity: Follow [Solidity Style Guide](https://docs.soliditylang.org/en/v0.8.19/style-guide.html)
- JavaScript: ESLint configuration provided
- Commit messages: Follow [Conventional Commits](https://www.conventionalcommits.org/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Discord: [Join our community](#)
- Twitter: [@XIOProtocol](#)
- Documentation: [docs.xioprotocol.io](#)
- Email: support@xioprotocol.io

## Acknowledgments

- OpenZeppelin for secure contract implementations
- Hardhat development environment
- Base and Hyperliquid networks
- Fjord Foundry team
- All our contributors and community members