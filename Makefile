# Makefile for XIO Token project
.PHONY: all install clean test compile lint deploy-base deploy-hyperliquid verify help snapshot

# Default target
all: install compile test

# Help command
help:
	@echo "Available commands:"
	@echo "  make install          - Install all dependencies"
	@echo "  make compile         - Compile all contracts"
	@echo "  make clean           - Remove build artifacts"
	@echo "  make test            - Run all tests"
	@echo "  make coverage        - Run test coverage"
	@echo "  make lint            - Run solhint on contracts"
	@echo "  make format          - Format contracts using prettier"
	@echo "  make deploy-goerli   - Deploy to Base Goerli testnet"
	@echo "  make deploy-base     - Deploy to Base mainnet"
	@echo "  make deploy-hl       - Deploy to Hyperliquid L1"
	@echo "  make verify          - Verify contract deployments"
	@echo "  make snapshot        - Set up Snapshot space"
	@echo "  make check           - Run pre-deployment checks"
	@echo "  make monitor         - Start monitoring system"

# Installation and setup
install:
	@echo "Installing dependencies..."
	npm install
	cp -n .env.example .env || true

# Cleaning
clean:
	@echo "Cleaning build artifacts..."
	rm -rf cache
	rm -rf artifacts
	rm -rf typechain-types
	rm -rf coverage
	rm -rf coverage.json

# Compilation
compile:
	@echo "Compiling contracts..."
	npx hardhat compile

# Testing
test:
	@echo "Running tests..."
	npx hardhat test

coverage:
	@echo "Running test coverage..."
	npx hardhat coverage

# Code quality
lint:
	@echo "Running solhint..."
	npx solhint 'contracts/**/*.sol'
	npx prettier --check 'contracts/**/*.sol'

format:
	@echo "Formatting contracts..."
	npx prettier --write 'contracts/**/*.sol'
	npx solhint 'contracts/**/*.sol' --fix

# Deployment commands
deploy-goerli:
	@echo "Deploying to Base Goerli..."
	@if [ ! -f .env ]; then echo "Error: .env file not found"; exit 1; fi
	npx hardhat run scripts/deploy-governance-system.js --network base_goerli

deploy-base:
	@echo "Deploying to Base mainnet..."
	@if [ ! -f .env ]; then echo "Error: .env file not found"; exit 1; fi
	@echo "Are you sure you want to deploy to Base mainnet? [y/N]" && read ans && [ $${ans:-N} = y ]
	npx hardhat run scripts/deploy-governance-system.js --network base_mainnet

deploy-hl:
	@echo "Deploying to Hyperliquid L1..."
	@if [ ! -f .env ]; then echo "Error: .env file not found"; exit 1; fi
	@echo "Are you sure you want to deploy to Hyperliquid? [y/N]" && read ans && [ $${ans:-N} = y ]
	npx hardhat run scripts/deploy-governance-system.js --network hyperliquid

# Verification
verify:
	@echo "Verifying contract setup..."
	npx hardhat run scripts/verify-governance-setup.js

# Snapshot setup
snapshot:
	@echo "Setting up Snapshot space..."
	npx hardhat run scripts/setup-snapshot.js

# Pre-deployment checks
check: lint test coverage verify
	@echo "Running final deployment checks..."
	@if [ ! -f .env ]; then echo "Error: .env file not found"; exit 1; fi
	@echo "Checking environment variables..."
	@bash -c ' \
		required_vars=( \
			"BASE_MAINNET_RPC_URL" \
			"BASE_GOERLI_RPC_URL" \
			"HYPERLIQUID_RPC_URL" \
			"BASESCAN_API_KEY" \
			"PRIVATE_KEY" \
		); \
		for var in "$${required_vars[@]}"; do \
			if [ -z "$$(grep -E "^$$var=.+" .env)" ]; then \
				echo "Error: $$var is not set in .env file"; \
				exit 1; \
			fi \
		done \
	'
	@echo "All checks passed!"

# Monitoring
monitor:
	@echo "Starting monitoring system..."
	@if [ ! -f .env ]; then echo "Error: .env file not found"; exit 1; fi
	node scripts/monitor.js

# Contract size check
size:
	@echo "Checking contract sizes..."
	npx hardhat size-contracts

# Gas estimation
gas:
	@echo "Estimating gas costs..."
	REPORT_GAS=true npx hardhat test

# Documentation generation
docs:
	@echo "Generating documentation..."
	npx hardhat docgen

# Version management
.PHONY: version
version:
	@echo "Current version: $$(node -p "require('./package.json').version")"

# Upgradeability check (for future upgradeable contracts)
check-upgrade:
	@echo "Checking upgrade safety..."
	npx hardhat run scripts/check-upgrade.js

# Task bundling
.PHONY: prepare-deploy
prepare-deploy: clean install compile test lint verify
	@echo "Deployment preparation complete!"

.PHONY: prepare-release
prepare-release: check size gas docs
	@echo "Release preparation complete!"

# Development utilities
.PHONY: console
console:
	npx hardhat console

.PHONY: node
node:
	npx hardhat node