#!/bin/bash

# Create a new branch
git checkout -b feature/makefile-update

# Add changes
git add Makefile
git add hardhat.config.js
git add package.json
git add .env.example
git add scripts/
git add contracts/
git add test/

# Create commit
git commit -m "Update Makefile with comprehensive build and deployment tasks

- Add complete set of build and deployment tasks
- Include test and verification commands
- Add environment checks and safety prompts
- Include monitoring and documentation tasks
- Add development utilities"

echo "Changes committed locally to feature/makefile-update branch"