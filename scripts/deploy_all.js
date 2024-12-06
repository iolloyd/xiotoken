const hre = require("hardhat");
const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("Starting deployment process...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy XGEN Token
    console.log("\nDeploying XGEN Token...");
    const totalSupply = ethers.utils.parseEther(process.env.TOTAL_SUPPLY || "100000000");
    const seedRoundAllocation = ethers.utils.parseEther(process.env.SEED_ROUND_ALLOCATION || "10000000");
    const tokenPrice = process.env.TOKEN_PRICE || "100000000";
    const rateLimitAmount = ethers.utils.parseEther(process.env.RATE_LIMIT_AMOUNT || "100000");
    const rateLimitPeriod = process.env.RATE_LIMIT_PERIOD || "3600";

    const XGEN = await ethers.getContractFactory("XGEN");
    const xgen = await XGEN.deploy(
        totalSupply,
        seedRoundAllocation,
        tokenPrice,
        rateLimitAmount,
        rateLimitPeriod
    );
    await xgen.deployed();
    console.log("XGEN token deployed to:", xgen.address);

    // Deploy XIO Token
    console.log("\nDeploying XIO Token...");
    const XIO = await ethers.getContractFactory("XIO");
    const xio = await XIO.deploy();
    await xio.deployed();
    console.log("XIO token deployed to:", xio.address);

    // Deploy TokenSwap
    console.log("\nDeploying TokenSwap...");
    const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
    const swapStartTime = currentTime + (process.env.SWAP_START_DELAY || 86400); // Default 24 hours
    const swapDuration = process.env.SWAP_DURATION || 259200; // Default 3 days
    const emergencyRecovery = process.env.MULTISIG_ADDRESS || deployer.address;

    const TokenSwap = await ethers.getContractFactory("TokenSwap");
    const tokenSwap = await TokenSwap.deploy(
        xgen.address,
        xio.address,
        swapStartTime,
        swapDuration,
        rateLimitAmount,
        rateLimitPeriod,
        emergencyRecovery
    );
    await tokenSwap.deployed();
    console.log("TokenSwap deployed to:", tokenSwap.address);

    // Setup roles and permissions
    console.log("\nSetting up roles and permissions...");
    
    // XGEN Token setup
    const adminAddresses = (process.env.ADMIN_ADDRESSES || "").split(",").filter(a => a);
    const pauserAddresses = (process.env.PAUSER_ADDRESSES || "").split(",").filter(a => a);
    const minterAddresses = (process.env.MINTER_ADDRESSES || "").split(",").filter(a => a);

    for (const admin of adminAddresses) {
        await xgen.grantRole(await xgen.DEFAULT_ADMIN_ROLE(), admin);
        console.log(`Granted admin role on XGEN to ${admin}`);
    }

    for (const pauser of pauserAddresses) {
        await xgen.grantRole(await xgen.PAUSER_ROLE(), pauser);
        console.log(`Granted pauser role on XGEN to ${pauser}`);
    }

    for (const minter of minterAddresses) {
        await xgen.grantRole(await xgen.MINTER_ROLE(), minter);
        console.log(`Granted minter role on XGEN to ${minter}`);
    }

    // TokenSwap setup
    await xio.mint(tokenSwap.address, totalSupply);
    console.log("Minted XIO tokens to TokenSwap contract");

    // Verify contracts if not on localhost
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\nWaiting for block confirmations...");
        await xgen.deployTransaction.wait(6);
        await xio.deployTransaction.wait(6);
        await tokenSwap.deployTransaction.wait(6);

        console.log("\nVerifying contracts on Etherscan...");
        
        await hre.run("verify:verify", {
            address: xgen.address,
            constructorArguments: [
                totalSupply,
                seedRoundAllocation,
                tokenPrice,
                rateLimitAmount,
                rateLimitPeriod
            ],
        });

        await hre.run("verify:verify", {
            address: xio.address,
            constructorArguments: [],
        });

        await hre.run("verify:verify", {
            address: tokenSwap.address,
            constructorArguments: [
                xgen.address,
                xio.address,
                swapStartTime,
                swapDuration,
                rateLimitAmount,
                rateLimitPeriod,
                emergencyRecovery
            ],
        });
    }

    // Output deployment summary
    console.log("\nDeployment Summary:");
    console.log("===================");
    console.log("XGEN Token:", xgen.address);
    console.log("XIO Token:", xio.address);
    console.log("TokenSwap:", tokenSwap.address);
    console.log("Emergency Recovery:", emergencyRecovery);
    console.log("Swap Start Time:", new Date(swapStartTime * 1000).toISOString());
    console.log("Swap End Time:", new Date((swapStartTime + swapDuration) * 1000).toISOString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
