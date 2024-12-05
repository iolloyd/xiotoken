# Deployment Guide

## Prerequisites
- Node.js and npm installed
- Access to Base and Hyperliquid networks
- Private key with sufficient funds

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
```
Edit `.env` with your credentials.

## Deployment Steps

### 1. Deploy XGEN on Base
```bash
npm run deploy:base
```
Save the deployed address in `.env` as `XGEN_ADDRESS`

### 2. Configure Fjord Foundry
- Access Fjord Foundry interface
- Configure sale parameters with deployed XGEN address
- Set duration, price, and allocation
- Enable whitelisting if required

### 3. Deploy XIO on Hyperliquid
```bash
npm run deploy:hyperliquid
```
Save the deployed address in `.env` as `XIO_ADDRESS`

### 4. Deploy Swap Contract
```bash
node scripts/deploy-swap.js
```

### 5. Verify Contracts
```bash
npx hardhat verify --network base $XGEN_ADDRESS
npx hardhat verify --network hyperliquid $XIO_ADDRESS
npx hardhat verify --network base $SWAP_ADDRESS "$XGEN_ADDRESS" "$XIO_ADDRESS" "$SWAP_START_TIME"
```

## Post-Deployment

1. Grant necessary roles on both tokens
2. Fund swap contract with XIO tokens
3. Configure multisig wallets
4. Set up Snapshot governance
5. Initialize Mangna integration