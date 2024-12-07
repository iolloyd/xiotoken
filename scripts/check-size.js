const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const MAX_CONTRACT_SIZE = 24576; // Ethereum max contract size in bytes

async function checkContractSizes() {
    console.log("Checking contract sizes...");

    const contracts = [
        "XIO",
        "XIOGovernance",
        "XIOTokenManager",
        "TokenSwap"
    ];

    const results = [];
    let hasWarnings = false;

    for (const contractName of contracts) {
        try {
            const factory = await ethers.getContractFactory(contractName);
            const bytecode = factory.bytecode;
            const size = (bytecode.length - 2) / 2; // Remove 0x and convert to bytes

            const sizeInfo = {
                name: contractName,
                size,
                percentageOfLimit: ((size / MAX_CONTRACT_SIZE) * 100).toFixed(2)
            };

            results.push(sizeInfo);

            if (size > MAX_CONTRACT_SIZE * 0.9) {
                hasWarnings = true;
            }
        } catch (error) {
            console.log(`Skipping ${contractName}: ${error.message}`);
        }
    }

    // Sort by size descending
    results.sort((a, b) => b.size - a.size);

    // Display results
    console.log("\nContract Sizes:");
    console.log("---------------");
    results.forEach(({ name, size, percentageOfLimit }) => {
        const sizeKB = (size / 1024).toFixed(2);
        const status = size > MAX_CONTRACT_SIZE ? "❌" :
            size > MAX_CONTRACT_SIZE * 0.9 ? "⚠️" : "✓";

        console.log(
            `${status} ${name}: ${sizeKB} KB (${percentageOfLimit}% of limit)`
        );
    });

    if (hasWarnings) {
        console.log("\n⚠️  Warning: Some contracts are approaching size limit!");
        console.log("Consider implementing the following optimizations:");
        console.log("1. Remove unused functions");
        console.log("2. Optimize data types and variable packing");
        console.log("3. Move non-critical functions to satellite contracts");
        console.log("4. Use libraries for shared functionality");
    }

    // Write detailed report
    const report = {
        timestamp: new Date().toISOString(),
        maxSize: MAX_CONTRACT_SIZE,
        contracts: results,
        warnings: hasWarnings
    };

    const reportsDir = path.join(__dirname, "../reports");
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir);
    }

    fs.writeFileSync(
        path.join(reportsDir, "contract-sizes.json"),
        JSON.stringify(report, null, 2)
    );

    return { results, hasWarnings };
}

if (require.main === module) {
    checkContractSizes()
        .then(({ hasWarnings }) => {
            process.exit(hasWarnings ? 1 : 0);
        })
        .catch((error) => {
            console.error("Size check failed:", error);
            process.exit(1);
        });
}

module.exports = {
    checkContractSizes,
    MAX_CONTRACT_SIZE
};