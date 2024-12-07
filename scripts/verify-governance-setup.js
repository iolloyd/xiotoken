const { ethers } = require("hardhat");
const config = require("./config/governance-config");
const fs = require("fs");
const path = require("path");

async function verifyContract(name, address, contract) {
    console.log(`\nVerifying ${name}...`);
    const checks = [];
    
    try {
        // Basic checks
        checks.push({
            name: "Contract exists",
            result: (await ethers.provider.getCode(address)) !== "0x",
            critical: true
        });

        if (contract) {
            const instance = await ethers.getContractAt(name, address);
            
            // Specific contract checks
            if (name === "XIOGovernance") {
                checks.push({
                    name: "Quorum threshold",
                    result: (await instance.quorumThreshold()).toString() === ethers.utils.parseEther(config.quorumThreshold).toString(),
                    critical: true
                });
                
                checks.push({
                    name: "Proposal threshold",
                    result: (await instance.proposalThreshold()).toString() === ethers.utils.parseEther(config.proposalThreshold).toString(),
                    critical: true
                });
            }
            
            if (name === "XIOTokenManager") {
                // Add TokenManager specific checks
                checks.push({
                    name: "Transfer delay",
                    result: (await instance.TRANSFER_DELAY()).toString() === config.transferDelay.toString(),
                    critical: true
                });
            }
        }
    } catch (error) {
        console.error(`Error verifying ${name}:`, error);
        return false;
    }

    // Display results
    let allPassed = true;
    console.log(`\nResults for ${name}:`);
    for (const check of checks) {
        console.log(`${check.result ? "✓" : "✗"} ${check.name}`);
        if (!check.result && check.critical) allPassed = false;
    }

    return allPassed;
}

async function main() {
    console.log("Starting governance setup verification...");

    // Load deployment data
    const deploymentPath = path.join(__dirname, "..", "deployment.local.json");
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    // Required addresses
    const {
        xioToken: xioTokenAddress,
        governance: governanceAddress,
        tokenManager: tokenManagerAddress
    } = deploymentData;

    // Verify all required addresses exist
    const requiredAddresses = {
        "XIO Token": xioTokenAddress,
        "Governance": governanceAddress,
        "Token Manager": tokenManagerAddress
    };

    let missingAddresses = Object.entries(requiredAddresses)
        .filter(([_, address]) => !address)
        .map(([name]) => name);

    if (missingAddresses.length > 0) {
        console.error("Missing required addresses:", missingAddresses.join(", "));
        process.exit(1);
    }

    // Verify each contract
    const verifications = await Promise.all([
        verifyContract("XIOGovernance", governanceAddress, true),
        verifyContract("XIOTokenManager", tokenManagerAddress, true)
    ]);

    if (verifications.some(v => !v)) {
        console.error("\n❌ Verification failed!");
        process.exit(1);
    }

    // Verify permissions
    console.log("\nVerifying permissions...");
    const governance = await ethers.getContractAt("XIOGovernance", governanceAddress);
    const tokenManager = await ethers.getContractAt("XIOTokenManager", tokenManagerAddress);

    const EXECUTOR_ROLE = await governance.EXECUTOR_ROLE();
    const OPERATOR_ROLE = await tokenManager.OPERATOR_ROLE();

    const permissionsChecks = [
        {
            name: "TokenManager has EXECUTOR_ROLE in Governance",
            result: await governance.hasRole(EXECUTOR_ROLE, tokenManagerAddress)
        },
        {
            name: "Governance has OPERATOR_ROLE in TokenManager",
            result: await tokenManager.hasRole(OPERATOR_ROLE, governanceAddress)
        }
    ];

    console.log("\nPermissions check results:");
    for (const check of permissionsChecks) {
        console.log(`${check.result ? "✓" : "✗"} ${check.name}`);
        if (!check.result) {
            console.error(`❌ Missing required permission: ${check.name}`);
            process.exit(1);
        }
    }

    console.log("\n✅ All verifications passed!");
    console.log("\nDeployment Info:");
    console.log("---------------");
    console.log(`Network: ${hre.network.name}`);
    console.log(`XIO Token: ${xioTokenAddress}`);
    console.log(`Governance: ${governanceAddress}`);
    console.log(`Token Manager: ${tokenManagerAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\nVerification failed:", error);
        process.exit(1);
    });