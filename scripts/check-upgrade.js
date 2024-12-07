const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function compareStorageLayout(oldContract, newContract) {
    // This is a simplified storage layout check
    // In production, you'd want to use a more comprehensive tool
    const warnings = [];
    const errors = [];

    // Get storage layout using hardhat-storage-layout
    const oldLayout = await hre.storageLayout.getStorageLayout(oldContract);
    const newLayout = await hre.storageLayout.getStorageLayout(newContract);

    // Compare storage slots
    oldLayout.storage.forEach((oldItem, index) => {
        const newItem = newLayout.storage[index];
        if (!newItem) {
            errors.push(`Storage slot ${index} removed: ${oldItem.label}`);
            return;
        }

        if (oldItem.type !== newItem.type) {
            errors.push(
                `Storage type mismatch at slot ${index}: ${oldItem.label} changed from ${oldItem.type} to ${newItem.type}`
            );
        }

        if (oldItem.label !== newItem.label) {
            warnings.push(
                `Storage label changed at slot ${index}: ${oldItem.label} -> ${newItem.label}`
            );
        }
    });

    return { warnings, errors };
}

async function checkUpgradeSafety() {
    console.log("Checking upgrade safety...");

    const deploymentPath = path.join(__dirname, "../deployment.local.json");
    if (!fs.existsSync(deploymentPath)) {
        console.error("No deployment.local.json found");
        return;
    }

    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    // List of contracts to check
    const contracts = [
        { name: "XIOGovernance", address: deploymentData.governance },
        { name: "XIOTokenManager", address: deploymentData.tokenManager },
        { name: "XIO", address: deploymentData.xioToken }
    ];

    for (const contract of contracts) {
        console.log(`\nChecking ${contract.name}...`);

        try {
            // Load current implementation
            const currentContract = await ethers.getContractAt(
                contract.name,
                contract.address
            );

            // Compare with new implementation
            const { warnings, errors } = await compareStorageLayout(
                contract.name,
                `${contract.name}V2`  // Assuming V2 naming convention
            );

            // Report findings
            if (warnings.length > 0) {
                console.log("\nWarnings:");
                warnings.forEach(w => console.log(`- ${w}`));
            }

            if (errors.length > 0) {
                console.log("\nErrors:");
                errors.forEach(e => console.log(`- ${e}`));
                throw new Error(`Upgrade safety checks failed for ${contract.name}`);
            }

            // Check function signatures
            const currentABI = currentContract.interface.format();
            const newFactory = await ethers.getContractFactory(`${contract.name}V2`);
            const newABI = newFactory.interface.format();

            // Compare function signatures
            const removedFunctions = currentABI.filter(
                sig => !newABI.includes(sig)
            );
            if (removedFunctions.length > 0) {
                console.log("\nWarning: Removed functions detected:");
                removedFunctions.forEach(f => console.log(`- ${f}`));
            }

            console.log(`✓ ${contract.name} upgrade checks passed`);

        } catch (error) {
            if (error.message.includes("cannot find")) {
                console.log(`No V2 contract found for ${contract.name}, skipping...`);
                continue;
            }
            throw error;
        }
    }
}

if (require.main === module) {
    checkUpgradeSafety()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("Upgrade safety check failed:", error);
            process.exit(1);
        });
}

module.exports = {
    checkUpgradeSafety,
    compareStorageLayout,
};