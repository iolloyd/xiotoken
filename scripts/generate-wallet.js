const { ethers } = require("ethers");

async function main() {
    // Create a new random wallet
    const wallet = ethers.Wallet.createRandom();
    
    console.log("\n=== New Wallet Generated ===");
    console.log(`Address: ${wallet.address}`);
    console.log(`Private Key: ${wallet.privateKey}`);
    console.log(`Mnemonic: ${wallet.mnemonic.phrase}`);
    console.log("\nIMPORTANT: Save these details securely!");
    console.log("Never share your private key or mnemonic phrase with anyone!");
    
    // Format for .env file
    console.log("\n=== For .env file ===");
    console.log(`PRIVATE_KEY=${wallet.privateKey}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
