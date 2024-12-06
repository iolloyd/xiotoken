const { ethers } = require("hardhat");
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Configure alert thresholds
const THRESHOLDS = {
    LARGE_TRANSFER: ethers.utils.parseEther("100000"), // 100k tokens
    BURN_SIZE_WARNING: ethers.utils.parseEther("1000000"), // 1M tokens
    HIGH_RATE_USAGE: 0.9, // 90% of rate limit
    ROLE_CHANGE_ALERT: true,
    EMERGENCY_MODE_ALERT: true
};

async function main() {
    // Connect to contracts
    const XGEN = await ethers.getContractFactory("XGEN");
    const XIO = await ethers.getContractFactory("XIO");
    const TokenSwap = await ethers.getContractFactory("TokenSwap");

    const xgen = await XGEN.attach(process.env.XGEN_ADDRESS);
    const xio = await XIO.attach(process.env.XIO_ADDRESS);
    const tokenSwap = await TokenSwap.attach(process.env.TOKENSWAP_ADDRESS);

    console.log("Starting monitoring system...");
    
    // Initialize log file
    const logFile = path.join(__dirname, '../logs/monitor.log');
    ensureDirectoryExists(path.dirname(logFile));

    // Monitor XGEN events
    xgen.on("Transfer", async (from, to, value) => {
        if (value.gt(THRESHOLDS.LARGE_TRANSFER)) {
            const alert = `ALERT: Large XGEN transfer - ${ethers.utils.formatEther(value)} XGEN from ${from} to ${to}`;
            logAlert(logFile, alert);
        }
    });

    // Monitor XIO events
    xio.on("Transfer", async (from, to, value) => {
        if (value.gt(THRESHOLDS.LARGE_TRANSFER)) {
            const alert = `ALERT: Large XIO transfer - ${ethers.utils.formatEther(value)} XIO from ${from} to ${to}`;
            logAlert(logFile, alert);
        }
    });

    xio.on("TokensBurned", async (amount, totalBurned, timestamp) => {
        if (amount.gt(THRESHOLDS.BURN_SIZE_WARNING)) {
            const alert = `ALERT: Large token burn - ${ethers.utils.formatEther(amount)} XIO burned`;
            logAlert(logFile, alert);
        }
    });

    xio.on("RateLimitExceeded", async (from, to, amount, limit) => {
        const alert = `ALERT: Rate limit exceeded - ${from} attempted to transfer ${ethers.utils.formatEther(amount)} XIO`;
        logAlert(logFile, alert);
    });

    // Monitor TokenSwap events
    tokenSwap.on("TokensSwapped", async (user, xgenAmount, xioAmount, timestamp) => {
        const alert = `INFO: Swap executed - ${ethers.utils.formatEther(xgenAmount)} XGEN for ${ethers.utils.formatEther(xioAmount)} XIO by ${user}`;
        logAlert(logFile, alert);
    });

    tokenSwap.on("EmergencyModeActivated", async (timestamp) => {
        if (THRESHOLDS.EMERGENCY_MODE_ALERT) {
            const alert = `CRITICAL: Emergency mode activated in TokenSwap at ${new Date(timestamp * 1000).toISOString()}`;
            logAlert(logFile, alert);
        }
    });

    // Start periodic checks
    setInterval(async () => {
        await checkRateLimitUsage(xio, logFile);
        await checkSwapStatus(tokenSwap, logFile);
        await checkBurnSchedule(xio, logFile);
    }, 300000); // Every 5 minutes

    console.log("Monitoring system active. Check logs for alerts.");
}

async function checkRateLimitUsage(xio, logFile) {
    try {
        const filter = xio.filters.Transfer();
        const events = await xio.queryFilter(filter, -1000, "latest"); // Last 1000 blocks
        
        const addressUsage = new Map();
        for (const event of events) {
            const status = await xio.getRateLimitStatus(event.args.from);
            const usagePercent = status.currentPeriodTransfers.mul(100).div(await xio.rateLimitAmount());
            
            if (usagePercent.gt(THRESHOLDS.HIGH_RATE_USAGE * 100)) {
                addressUsage.set(event.args.from, usagePercent);
            }
        }

        if (addressUsage.size > 0) {
            const alert = "ALERT: High rate limit usage detected:\n" + 
                Array.from(addressUsage.entries())
                    .map(([addr, usage]) => `${addr}: ${usage}%`)
                    .join('\n');
            logAlert(logFile, alert);
        }
    } catch (error) {
        logAlert(logFile, `ERROR: Failed to check rate limit usage - ${error.message}`);
    }
}

async function checkSwapStatus(tokenSwap, logFile) {
    try {
        const currentTime = Math.floor(Date.now() / 1000);
        const swapStartTime = await tokenSwap.swapStartTime();
        const swapEndTime = await tokenSwap.swapEndTime();

        if (currentTime >= swapStartTime && currentTime <= swapEndTime) {
            const remainingTime = swapEndTime - currentTime;
            if (remainingTime < 86400) { // Less than 1 day
                const alert = `ALERT: Swap period ending in ${Math.floor(remainingTime / 3600)} hours`;
                logAlert(logFile, alert);
            }
        }
    } catch (error) {
        logAlert(logFile, `ERROR: Failed to check swap status - ${error.message}`);
    }
}

async function checkBurnSchedule(xio, logFile) {
    try {
        const burnStats = await xio.getBurnStats();
        const currentTime = Math.floor(Date.now() / 1000);
        const nextBurn = burnStats.nextBurnAllowed.toNumber();

        if (currentTime >= nextBurn) {
            const alert = "ALERT: Quarterly burn is now available to execute";
            logAlert(logFile, alert);
        }
    } catch (error) {
        logAlert(logFile, `ERROR: Failed to check burn schedule - ${error.message}`);
    }
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function logAlert(logFile, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    console.log(logMessage.trim());
    fs.appendFileSync(logFile, logMessage);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
