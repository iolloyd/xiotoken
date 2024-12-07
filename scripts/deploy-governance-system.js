const hre = require("hardhat");
const { ethers } = require("hardhat");
const config = require("./config/governance-config");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting governance system deployment...");

    // Load network configuration
    const networkName = hre.network.name;
    const networkConfig = config.networks[networkName];
    
    if (!networkConfig) {
        throw new Error(`No configuration found for network: ${networkName}`);
    }

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying contracts with account: ${deployer.address}`);
    console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

    // Load XIO token address
    const deploymentPath = path.join(__dirname, "..", "deployment.local.json");
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const xioTokenAddress = deploymentData.xioToken;

    if (!xioTokenAddress) {
        throw new Error("XIO token address not found in deployment.local.json");
    }

    console.log(`Using XIO token at address: ${xioTokenAddress}`);

    try {
        // Deploy Governance Contract
        console.log("\nDeploying XIOGovernance...");
        const XIOGovernance = await ethers.getContractFactory("XIOGovernance");
        const governance = await XIOGovernance.deploy(
            xioTokenAddress,
            ethers.utils.parseEther(config.quorumThreshold),
            ethers.utils.parseEther(config.proposalThreshold)
        );
        await governance.deployed();
        console.log(`XIOGovernance deployed to: ${governance.address}`);

        // Deploy Token Manager
        console.log("\nDeploying XIOTokenManager...");
        const XIOTokenManager = await ethers.getContractFactory("XIOTokenManager");
        const tokenManager = await XIOTokenManager.deploy(xioTokenAddress);
        await tokenManager.deployed();
        console.log(`XIOTokenManager deployed to: ${tokenManager.address}`);

        // Setup roles and permissions
        console.log("\nSetting up roles and permissions...");

        const EXECUTOR_ROLE = await governance.EXECUTOR_ROLE();
        const PROPOSER_ROLE = await governance.PROPOSER_ROLE();
        const OPERATOR_ROLE = await tokenManager.OPERATOR_ROLE();
        
        console.log("Granting roles...");
        
        // Setup governance roles
        await (await governance.grantRole(EXECUTOR_ROLE, tokenManager.address)).wait();
        console.log("Granted EXECUTOR_ROLE to TokenManager");
        
        // Setup token manager roles
        await (await tokenManager.grantRole(OPERATOR_ROLE, governance.address)).wait();
        console.log("Granted OPERATOR_ROLE to Governance");

        // Set operator limits
        console.log("\nSetting operator limits...");
        await (await tokenManager.updateOperatorLimit(
            governance.address,
            ethers.utils.parseEther(config.operatorLimit)
        )).wait();
        console.log("Set operator limits for Governance contract");

        // Generate Snapshot configuration
        console.log("\nGenerating Snapshot configuration...");
        const snapshotConfig = {
            ...config.snapshot,
            strategies: [{
                name: "erc20-balance-of",
                params: {
                    address: xioTokenAddress,
                    symbol: "XIO",
                    decimals: 18
                }
            }],
            members: [governance.address],
            admins: [governance.address]
        };

        // Save Snapshot configuration
        const snapshotConfigPath = path.join(__dirname, "..", "snapshot-config.json");
        fs.writeFileSync(snapshotConfigPath, JSON.stringify(snapshotConfig, null, 2));
        console.log("Saved Snapshot configuration");

        // Update deployment data
        deploymentData.governance = governance.address;
        deploymentData.tokenManager = tokenManager.address;
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
        console.log("\nUpdated deployment.local.json");

        // Verify contracts if not on localhost
        if (networkName !== "localhost" && networkName !== "hardhat") {
            console.log("\nVerifying contracts on block explorer...");
            
            await hre.run("verify:verify", {
                address: governance.address,
                constructorArguments: [
                    xioTokenAddress,
                    ethers.utils.parseEther(config.quorumThreshold),
                    ethers.utils.parseEther(config.proposalThreshold)
                ]
            });
            
            await hre.run("verify:verify", {
                address: tokenManager.address,
                constructorArguments: [xioTokenAddress]
            });
            
            console.log("Contract verification complete");
        }

        console.log("\nDeployment Summary:");
        console.log("-------------------");
        console.log(`Network: ${networkName}`);
        console.log(`XIO Token: ${xioTokenAddress}`);
        console.log(`Governance: ${governance.address}`);
        console.log(`Token Manager: ${tokenManager.address}`);
        console.log(`Snapshot Space: ${networkConfig.snapshotSpace}`);
        console.log("\nNext steps:");
        console.log("1. Create Snapshot space using generated configuration");
        console.log("2. Set up Mangna integration with TokenManager");
        console.log("3. Test governance workflow end-to-end");
        console.log("4. Transfer admin roles to timelock/multisig");

    } catch (error) {
        console.error("\nDeployment failed:");
        console.error(error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });