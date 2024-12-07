const { ethers } = require("hardhat");
const axios = require("axios");

// Snapshot space setup configurations
const SPACE_CONFIG = {
    name: "XIO DAO",
    symbol: "XIO",
    domain: "snapshot.xio.network", // Update with actual domain
    about: "XIO DAO Governance",
    avatar: "", // Add IPFS hash for avatar
    website: "https://xio.network", // Update with actual website
    terms: "https://docs.xio.network/terms", // Update with actual terms
    github: "https://github.com/xio-protocol",
    twitter: "@xioprotocol",
    network: "1", // Ethereum mainnet
    strategies: [
        {
            name: "erc20-balance-of",
            params: {
                symbol: "XIO",
                decimals: 18
            }
        }
    ],
    voting: {
        delay: 0,
        period: 259200, // 3 days
        type: "single-choice",
        quorum: 100000 // 100k XIO tokens
    },
    proposals: {
        threshold: 10000, // 10k XIO tokens
        validate: true,
        minScore: 0
    }
};

async function main() {
    console.log("Setting up Snapshot space...");

    // Get deployment data
    const deploymentData = require('../deployment.local.json');
    const {
        xioToken: tokenAddress,
        governance: governanceAddress
    } = deploymentData;

    if (!tokenAddress || !governanceAddress) {
        throw new Error("Required contract addresses not found in deployment.local.json");
    }

    // Update strategy parameters with deployed token address
    SPACE_CONFIG.strategies[0].params.address = tokenAddress;
    
    // Create Snapshot space configuration
    const spaceConfig = {
        ...SPACE_CONFIG,
        filters: {
            minScore: 100, // Minimum score to create proposal
            onlyMembers: false
        },
        members: [
            governanceAddress // Governance contract as admin
        ],
        admins: [
            governanceAddress // Governance contract as admin

        ],
        validation: {
            name: "basic",
            params: {}
        }
    };

    // Save space configuration
    const fs = require('fs');
    fs.writeFileSync(
        'snapshot-space-config.json',
        JSON.stringify(spaceConfig, null, 2)
    );
    
    console.log("Snapshot space configuration saved to snapshot-space-config.json");
    console.log("");
    console.log("Next steps:");
    console.log("1. Create space on snapshot.org with saved configuration");
    console.log("2. Update space settings with governance contract");
    console.log("3. Test proposal creation and voting");
    console.log("");
    console.log("Important URLs:");
    console.log("- Snapshot UI: https://snapshot.org/#/xio.eth");
    console.log("- Governance Contract:", governanceAddress);
    console.log("- XIO Token Contract:", tokenAddress);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });