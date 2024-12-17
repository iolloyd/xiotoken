# Deployment Guide

## Prerequisites
- Node.js and npm installed
- Access to Base network
- Private key with sufficient ETH for deployment
- Environment variables configured

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

### 1. Deploy XGEN Token
```bash
npm run deploy:xgen:base
```

### 2. Deploy XIO Token
```bash
npm run deploy:xio:base
```

### 3. Verify Contracts
```bash
# Verify on Base
npx hardhat verify --network base $CONTRACT_ADDRESS
```

## Post-Deployment

1. Grant necessary roles on both tokens
2. Fund swap contract with XIO tokens
3. Configure multisig wallets
4. Set up Snapshot governance
5. Initialize Mangna integration