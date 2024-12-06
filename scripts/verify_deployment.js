const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("Starting deployment verification...");

    // Get deployed contract addresses
    const XGEN_ADDRESS = process.env.XGEN_ADDRESS;
    const XIO_ADDRESS = process.env.XIO_ADDRESS;
    const TOKENSWAP_ADDRESS = process.env.TOKENSWAP_ADDRESS;

    if (!XGEN_ADDRESS || !XIO_ADDRESS || !TOKENSWAP_ADDRESS) {
        throw new Error("Missing contract addresses in .env");
    }

    // Connect to contracts
    const XGEN = await ethers.getContractFactory("XGEN");
    const XIO = await ethers.getContractFactory("XIO");
    const TokenSwap = await ethers.getContractFactory("TokenSwap");

    const xgen = await XGEN.attach(XGEN_ADDRESS);
    const xio = await XIO.attach(XIO_ADDRESS);
    const tokenSwap = await TokenSwap.attach(TOKENSWAP_ADDRESS);

    console.log("\nVerifying XGEN Token...");
    await verifyXGEN(xgen);

    console.log("\nVerifying XIO Token...");
    await verifyXIO(xio);

    console.log("\nVerifying TokenSwap...");
    await verifyTokenSwap(tokenSwap, xgen, xio);

    console.log("\nVerification completed successfully!");
}

async function verifyXGEN(xgen) {
    // Verify basic parameters
    console.log("Checking XGEN parameters...");
    const [name, symbol, totalSupply] = await Promise.all([
        xgen.name(),
        xgen.symbol(),
        xgen.totalSupply()
    ]);

    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Total Supply: ${ethers.utils.formatEther(totalSupply)} XGEN`);

    // Verify roles
    console.log("\nChecking XGEN roles...");
    const roles = [
        await xgen.DEFAULT_ADMIN_ROLE(),
        await xgen.PAUSER_ROLE(),
        await xgen.MINTER_ROLE(),
        await xgen.CONFIGURATOR_ROLE()
    ];

    for (const role of roles) {
        const roleMembers = await getRoleMembers(xgen, role);
        console.log(`Role ${role} members:`, roleMembers);
    }
}

async function verifyXIO(xio) {
    // Verify basic parameters
    console.log("Checking XIO parameters...");
    const [name, symbol, totalSupply, rateLimitAmount, rateLimitPeriod] = await Promise.all([
        xio.name(),
        xio.symbol(),
        xio.totalSupply(),
        xio.rateLimitAmount(),
        xio.rateLimitPeriod()
    ]);

    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Total Supply: ${ethers.utils.formatEther(totalSupply)} XIO`);
    console.log(`Rate Limit Amount: ${ethers.utils.formatEther(rateLimitAmount)} XIO`);
    console.log(`Rate Limit Period: ${rateLimitPeriod} seconds`);

    // Verify burn parameters
    const burnStats = await xio.getBurnStats();
    console.log("\nBurn Statistics:");
    console.log(`Total Burned: ${ethers.utils.formatEther(burnStats.totalBurnt)} XIO`);
    console.log(`Remaining to Burn: ${ethers.utils.formatEther(burnStats.remainingToBurn)} XIO`);
    console.log(`Next Burn Allowed: ${new Date(burnStats.nextBurnAllowed.toNumber() * 1000)}`);
}

async function verifyTokenSwap(tokenSwap, xgen, xio) {
    // Verify basic parameters
    console.log("Checking TokenSwap parameters...");
    const [
        xgenAddress,
        xioAddress,
        swapStartTime,
        swapEndTime,
        rateLimitAmount,
        rateLimitPeriod,
        emergencyRecovery
    ] = await Promise.all([
        tokenSwap.xgenToken(),
        tokenSwap.xioToken(),
        tokenSwap.swapStartTime(),
        tokenSwap.swapEndTime(),
        tokenSwap.rateLimitAmount(),
        tokenSwap.rateLimitPeriod(),
        tokenSwap.emergencyRecoveryAddress()
    ]);

    console.log(`XGEN Token Address: ${xgenAddress}`);
    console.log(`XIO Token Address: ${xioAddress}`);
    console.log(`Swap Start: ${new Date(swapStartTime.toNumber() * 1000)}`);
    console.log(`Swap End: ${new Date(swapEndTime.toNumber() * 1000)}`);
    console.log(`Rate Limit Amount: ${ethers.utils.formatEther(rateLimitAmount)} tokens`);
    console.log(`Rate Limit Period: ${rateLimitPeriod} seconds`);
    console.log(`Emergency Recovery Address: ${emergencyRecovery}`);

    // Verify token allowances
    const xioBalance = await xio.balanceOf(tokenSwap.address);
    console.log(`\nXIO Balance in Swap Contract: ${ethers.utils.formatEther(xioBalance)} XIO`);
}

async function getRoleMembers(contract, role) {
    const roleCount = await contract.getRoleMemberCount(role);
    const members = [];
    for (let i = 0; i < roleCount; i++) {
        members.push(await contract.getRoleMember(role, i));
    }
    return members;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
