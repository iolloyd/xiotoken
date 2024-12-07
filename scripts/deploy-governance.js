const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("Starting governance deployment...");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Get XIO token address from deployment.local.json
    const deploymentData = require('../deployment.local.json');
    const xioTokenAddress = deploymentData.xioToken;
    
    if (!xioTokenAddress) {
        throw new Error("XIO token address not found in deployment.local.json");
    }

    // Deploy XIOGovernance
    console.log("Deploying XIOGovernance...");
    const XIOGovernance = await ethers.getContractFactory("XIOGovernance");
    
    // Initial governance parameters
    const QUORUM_THRESHOLD = ethers.utils.parseEther("100000"); // 100k XIO tokens
    const PROPOSAL_THRESHOLD = ethers.utils.parseEther("10000"); // 10k XIO tokens
    
    const governance = await XIOGovernance.deploy(
        xioTokenAddress,
        QUORUM_THRESHOLD,
        PROPOSAL_THRESHOLD
    );
    await governance.deployed();
    console.log("XIOGovernance deployed to:", governance.address);

    // Deploy XIOTokenManager
    console.log("Deploying XIOTokenManager...");
    const XIOTokenManager = await ethers.getContractFactory("XIOTokenManager");
    const tokenManager = await XIOTokenManager.deploy(xioTokenAddress);
    await tokenManager.deployed();
    console.log("XIOTokenManager deployed to:", tokenManager.address);

    // Setup roles
    console.log("Setting up roles...");

    // Grant roles in Governance contract
    const EXECUTOR_ROLE = await governance.EXECUTOR_ROLE();
    const PROPOSER_ROLE = await governance.PROPOSER_ROLE();
    
    await governance.grantRole(EXECUTOR_ROLE, tokenManager.address);
    console.log("Granted EXECUTOR_ROLE to TokenManager");
    
    // Grant roles in TokenManager
    const OPERATOR_ROLE = await tokenManager.OPERATOR_ROLE();
    const TREASURY_ROLE = await tokenManager.TREASURY_ROLE();
    
    await tokenManager.grantRole(OPERATOR_ROLE, governance.address);
    console.log("Granted OPERATOR_ROLE to Governance");

    // Set initial operator limits
    const OPERATOR_LIMIT = ethers.utils.parseEther("50000"); // 50k XIO tokens
    await tokenManager.updateOperatorLimit(governance.address, OPERATOR_LIMIT);
    console.log("Set operator limit for Governance contract");

    // Update deployment.local.json
    deploymentData.governance = governance.address;
    deploymentData.tokenManager = tokenManager.address;
    
    const fs = require('fs');
    fs.writeFileSync(
        'deployment.local.json',
        JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("Deployment complete! Updated deployment.local.json");

    // Verify contracts on block explorer (if not on a local network)
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("Verifying contracts on block explorer...");
        
        await hre.run("verify:verify", {
            address: governance.address,
            constructorArguments: [
                xioTokenAddress,
                QUORUM_THRESHOLD,
                PROPOSAL_THRESHOLD
            ],
        });
        
        await hre.run("verify:verify", {
            address: tokenManager.address,
            constructorArguments: [xioTokenAddress],
        });
        
        console.log("Contract verification complete!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });