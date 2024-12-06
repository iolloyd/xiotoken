.PHONY: all install clean test coverage deploy monitor verify security-check docs

# Default target
all: install test

# Install dependencies
install:
	npm install

# Clean build artifacts
clean:
	npx hardhat clean
	rm -rf cache
	rm -rf artifacts
	rm -rf typechain-types
	rm -rf coverage
	rm -rf coverage.json

# Run tests
test:
	npx hardhat test

# Run tests with coverage
coverage:
	npx hardhat coverage

# Deploy contracts
deploy-base:
	npx hardhat run scripts/deploy_all.js --network base

deploy-testnet:
	npx hardhat run scripts/deploy_all.js --network baseGoerli

# Verify deployment
verify:
	node scripts/verify_deployment.js

# Start monitoring
monitor:
	node scripts/monitor.js

# Run security checks
security-check:
	npm audit
	npx slither .
	npx mythril analyze ./contracts/*.sol

# Generate documentation
docs:
	npx hardhat docgen

# Full deployment process
deploy-full: clean install test deploy-base verify monitor

# Full test process
test-full: clean install test coverage security-check

# Help
help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make test           - Run tests"
	@echo "  make coverage       - Run tests with coverage"
	@echo "  make deploy-base    - Deploy to Base network"
	@echo "  make deploy-testnet - Deploy to Base Goerli testnet"
	@echo "  make verify         - Verify deployment"
	@echo "  make monitor        - Start monitoring system"
	@echo "  make security-check - Run security audit tools"
	@echo "  make docs           - Generate documentation"
	@echo "  make deploy-full    - Full deployment process"
	@echo "  make test-full      - Full test process"