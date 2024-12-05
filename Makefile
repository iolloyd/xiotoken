.PHONY: all install clean test compile deploy-base deploy-hyperliquid deploy-swap verify-all help

# Default target
all: install test

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install

# Clean the project
clean:
	@echo "Cleaning project..."
	rm -rf cache
	rm -rf artifacts
	rm -rf node_modules
	rm -rf coverage

# Run tests
test:
	@echo "Running tests..."
	npx hardhat test

# Run tests with coverage
coverage:
	@echo "Running test coverage..."
	npx hardhat coverage

# Compile contracts
compile:
	@echo "Compiling contracts..."
	npx hardhat compile

# Deploy to Base network
deploy-base:
	@echo "Deploying XGEN to Base network..."
	npx hardhat run scripts/deploy.js --network base

# Deploy to Hyperliquid network
deploy-hyperliquid:
	@echo "Deploying XIO to Hyperliquid network..."
	npx hardhat run scripts/deploy.js --network hyperliquid

# Deploy swap contract
deploy-swap:
	@echo "Deploying swap contract..."
	node scripts/deploy-swap.js

# Verify contracts on respective networks
verify-base:
	@echo "Verifying XGEN contract..."
	npx hardhat verify --network base ${XGEN_ADDRESS}

verify-hyperliquid:
	@echo "Verifying XIO contract..."
	npx hardhat verify --network hyperliquid ${XIO_ADDRESS}

verify-swap:
	@echo "Verifying swap contract..."
	npx hardhat verify --network base ${SWAP_ADDRESS} "${XGEN_ADDRESS}" "${XIO_ADDRESS}" "${SWAP_START_TIME}"

verify-all: verify-base verify-hyperliquid verify-swap

# Setup local development environment
setup:
	@echo "Setting up development environment..."
	cp .env.example .env
	@echo "Please edit .env with your configuration"
	npm install

# Format code
format:
	@echo "Formatting code..."
	npx prettier --write 'contracts/**/*.sol'
	npx prettier --write 'test/**/*.js'
	npx prettier --write 'scripts/**/*.js'

# Lint code
lint:
	@echo "Linting code..."
	npx solhint 'contracts/**/*.sol'
	npx eslint 'test/**/*.js' 'scripts/**/*.js'

# Full deployment sequence
deploy-all: deploy-base deploy-hyperliquid deploy-swap verify-all
	@echo "Full deployment complete"

# Help command
help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies"
	@echo "  make clean          - Clean project files"
	@echo "  make test           - Run tests"
	@echo "  make coverage       - Run test coverage"
	@echo "  make compile        - Compile contracts"
	@echo "  make deploy-base    - Deploy to Base network"
	@echo "  make deploy-hyperliquid - Deploy to Hyperliquid network"
	@echo "  make deploy-swap    - Deploy swap contract"
	@echo "  make verify-all     - Verify all contracts"
	@echo "  make deploy-all     - Full deployment sequence"
	@echo "  make setup          - Initial project setup"
	@echo "  make format         - Format code"
	@echo "  make lint           - Lint code"