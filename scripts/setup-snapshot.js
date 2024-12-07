const { ethers } = require("hardhat");

// Snapshot space setup configurations
const SPACE_CONFIG = {
    name: "XIO DAO",
    symbol: "XIO",
    domain: "snapshot.xio.network",
    about: "XIO DAO Governance",
    website: "https://xio.network",
    terms: "https://docs.xio.network/terms",
    github: "https://github.com/xio-protocol",
    network: "1",
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
        period: 259200,
        type: "single-choice",
        quorum: 100000
    },
    proposals: {
        threshold: 10000,
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
            minScore: 100,
            onlyMembers: false
        },
        members: [
            governanceAddress
        ],
        admins: [
            governanceAddress
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
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });