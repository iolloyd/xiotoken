const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const MONITOR_INTERVAL = 60000; // 1 minute
const LOG_FILE = path.join(__dirname, "../logs/monitor.log");

async function ensureLogDirectory() {
    const logDir = path.join(__dirname, "../logs");
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
}

function logEvent(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
    console.log(logMessage.trim());
}

async function getContracts() {
    const deploymentData = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../deployment.local.json"), "utf8")
    );

    const governance = await ethers.getContractAt(
        "XIOGovernance",
        deploymentData.governance
    );
    const tokenManager = await ethers.getContractAt(
        "XIOTokenManager",
        deploymentData.tokenManager
    );
    const xioToken = await ethers.getContractAt(
        "XIO",
        deploymentData.xioToken
    );

    return { governance, tokenManager, xioToken };
}

async function monitorSystemHealth() {
    try {
        const { governance, tokenManager, xioToken } = await getContracts();

        // Check contract states
        const isPaused = await xioToken.paused();
        if (isPaused) {
            logEvent("WARNING: XIO Token is paused");
        }

        // Check role assignments
        const EXECUTOR_ROLE = await governance.EXECUTOR_ROLE();
        const hasExecutorRole = await governance.hasRole(
            EXECUTOR_ROLE,
            tokenManager.address
        );
        if (!hasExecutorRole) {
            logEvent("ERROR: TokenManager missing EXECUTOR_ROLE in Governance");
        }

        // Monitor pending transfers
        const events = await tokenManager.queryFilter(
            tokenManager.filters.TransferRequested(),
            -1000 // Last 1000 blocks
        );
        const pendingTransfers = events.length;
        logEvent(`INFO: ${pendingTransfers} pending transfers in system`);

        // Monitor proposal activity
        const proposalEvents = await governance.queryFilter(
            governance.filters.ProposalScheduled(),
            -1000
        );
        logEvent(`INFO: ${proposalEvents.length} recent proposals scheduled`);

        // Monitor token metrics
        const totalSupply = await xioToken.totalSupply();
        const totalBurned = await xioToken.totalBurned();
        logEvent(`INFO: Total Supply: ${ethers.utils.formatEther(totalSupply)} XIO`);
        logEvent(`INFO: Total Burned: ${ethers.utils.formatEther(totalBurned)} XIO`);

    } catch (error) {
        logEvent(`ERROR: Monitoring failed - ${error.message}`);
    }
}

async function startMonitoring() {
    await ensureLogDirectory();
    logEvent("Starting XIO system monitoring...");

    // Initial check
    await monitorSystemHealth();

    // Set up periodic monitoring
    setInterval(async () => {
        await monitorSystemHealth();
    }, MONITOR_INTERVAL);
}

if (require.main === module) {
    startMonitoring()
        .then(() => {
            console.log("Monitoring system initialized");
        })
        .catch((error) => {
            console.error("Failed to start monitoring:", error);
            process.exit(1);
        });
}

module.exports = {
    startMonitoring,
    monitorSystemHealth,
};