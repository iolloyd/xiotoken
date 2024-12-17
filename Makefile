# Makefile for XIO Token project
.PHONY: all install clean test compile lint deploy-base verify help snapshot

# Version
VERSION := $(shell node -p "require('./package.json').version")

# Network-specific variables
TIMESTAMP := $(shell date +%Y%m%d_%H%M%S)
BACKUP_DIR := backups
NETWORKS := goerli base_mainnet

# Default target
all: install compile test

# Help command
help:
	@echo "XIO Token System v$(VERSION) - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install          - Install all dependencies"
	@echo "  make compile         - Compile all contracts"
	@echo "  make clean           - Remove build artifacts"
	@echo "  make test            - Run all tests"
	@echo "  make coverage        - Run test coverage"
	@echo "  make lint            - Run solhint on contracts"
	@echo "  make format          - Format contracts using prettier"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-base     - Deploy to Base mainnet"
	@echo "  make verify          - Verify contract deployments"
	@echo ""
	@echo "Tools:"
	@echo "  make snapshot        - Set up Snapshot space"
	@echo "  make check           - Run pre-deployment checks"
	@echo "  make monitor         - Start monitoring system"
	@echo "  make backup          - Create deployment backup"
	@echo "  make restore         - Restore from backup"
	@echo ""
	@echo "Documentation:"
	@echo "  make docs            - Generate documentation"
	@echo "  make diagrams        - Generate architecture diagrams"
	@echo ""
	@echo "Analysis:"
	@echo "  make size            - Check contract sizes"
	@echo "  make gas             - Estimate gas costs"
	@echo "  make audit           - Run static analysis"

# Installation and setup
install:
	@echo "Installing dependencies..."
	npm install
	cp -n .env.example .env || true
	mkdir -p $(BACKUP_DIR)

# Development environment setup
.PHONY: setup-dev
setup-dev: install
	@echo "Setting up development environment..."
	npx hardhat compile
	npx hardhat node > logs/node.log 2>&1 & echo $$! > .node.pid
	@echo "Development node running (PID: $$(cat .node.pid))"

.PHONY: stop-dev
stop-dev:
	@if [ -f .node.pid ]; then \
		kill $$(cat .node.pid); \
		rm .node.pid; \
		echo "Development node stopped"; \
	else \
		echo "No development node running"; \
	fi

# Cleaning
clean:
	@echo "Cleaning build artifacts..."
	rm -rf cache
	rm -rf artifacts
	rm -rf typechain-types
	rm -rf coverage
	rm -rf coverage.json
	rm -rf logs/*.log

# Compilation
compile:
	@echo "Compiling contracts..."
	npx hardhat compile

# Testing
test: compile
	@echo "Running tests..."
	npx hardhat test

test-network/%: compile
	@echo "Running tests on network $*..."
	npx hardhat test --network $*

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

# Backup and restore
.PHONY: backup
backup:
	@echo "Creating deployment backup..."
	@mkdir -p $(BACKUP_DIR)/$(TIMESTAMP)
	@cp -r deployments/* $(BACKUP_DIR)/$(TIMESTAMP)/ || true
	@cp .env $(BACKUP_DIR)/$(TIMESTAMP)/ || true
	@echo "Backup created in $(BACKUP_DIR)/$(TIMESTAMP)"

.PHONY: restore
restore:
	@if [ -z "$(BACKUP)" ]; then \
		echo "Please specify BACKUP=timestamp to restore"; \
		exit 1; \
	fi
	@echo "Restoring from backup $(BACKUP)..."
	@cp -r $(BACKUP_DIR)/$(BACKUP)/* deployments/ || true
	@echo "Backup restored"

# Network-specific deployments
define deploy_template
deploy-$(1):
	@echo "Deploying to $(1)..."
	@if [ ! -f .env ]; then echo "Error: .env file not found"; exit 1; fi
	@if [ "$(1)" = "base_mainnet" ]; then \
		echo "Are you sure you want to deploy to $(1)? [y/N]" && read ans && [ $${ans:-N} = y ]; \
	fi
	npx hardhat run scripts/deploy-governance-system.js --network $(1)
	@echo "Creating deployment backup..."
	@make backup
endef

$(foreach network,$(NETWORKS),$(eval $(call deploy_template,$(network))))

# Verification
verify:
	@echo "Verifying contract setup..."
	npx hardhat run scripts/verify-governance-setup.js
	@for network in $(NETWORKS); do \
		echo "Verifying on $$network..."; \
		npx hardhat verify --network $$network; \
	done

# Documentation
.PHONY: docs diagrams
docs:
	@echo "Generating documentation..."
	npx hardhat docgen
	@echo "Generating additional docs..."
	node scripts/generate-docs.js

diagrams:
	@echo "Generating architecture diagrams..."
	npx mmdc -i docs/ARCHITECTURE.md -o docs/images/architecture.png

# Monitoring
.PHONY: monitor monitor-stop
monitor:
	@echo "Starting monitoring system..."
	@if [ ! -f .env ]; then echo "Error: .env file not found"; exit 1; fi
	node scripts/monitor.js > logs/monitor.log 2>&1 & echo $$! > .monitor.pid
	@echo "Monitoring system started (PID: $$(cat .monitor.pid))"

monitor-stop:
	@if [ -f .monitor.pid ]; then \
		kill $$(cat .monitor.pid); \
		rm .monitor.pid; \
		echo "Monitoring system stopped"; \
	else \
		echo "No monitoring system running"; \
	fi

# Security analysis
.PHONY: audit
audit: slither mythril
	@echo "Running security analysis..."

slither:
	@echo "Running Slither..."
	slither . || true

mythril:
	@echo "Running Mythril..."
	myth analyze contracts/*.sol --execution-timeout 900 || true

# Task bundling
.PHONY: prepare-deploy prepare-release
prepare-deploy: clean install compile test lint verify
	@echo "Deployment preparation complete!"

prepare-release: check size gas docs audit
	@echo "Release preparation complete!"

# Development utilities
.PHONY: console node
console:
	npx hardhat console

node:
	npx hardhat node

# CI/CD helpers
.PHONY: ci-test ci-deploy
ci-test: compile lint test coverage

ci-deploy: prepare-deploy
	@echo "Starting CI deployment..."
	@if [ "$$NETWORK" = "" ]; then \
		echo "Error: NETWORK environment variable not set"; \
		exit 1; \
	fi
	make deploy-$$NETWORK