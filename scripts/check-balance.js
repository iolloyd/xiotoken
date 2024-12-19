const { ethers } = require("ethers");
require('dotenv').config();

async function main() {
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not found in .env file");
    }

    // Base Sepolia network configuration
    const baseSepolia = {
        name: 'Base Sepolia',
        chainId: 84532,
        _defaultProvider: (providers) => new providers.JsonRpcProvider('https://sepolia.base.org')
    };

    // Connect to Base Sepolia
    const provider = ethers.getDefaultProvider(baseSepolia);
    
    // Create wallet instance
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Get balance
    const balance = await provider.getBalance(wallet.address);
    
    console.log("\n=== Wallet Balance on Base Sepolia ===");
    console.log(`Address: ${wallet.address}`);
    console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
    console.log("\nTo get Base Sepolia ETH:");
    console.log("1. First get Sepolia ETH from: https://sepoliafaucet.com/");
    console.log("2. Then bridge to Base Sepolia: https://bridge.base.org/deposit");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
