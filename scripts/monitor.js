// scripts/monitor.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load deployment info
  const deploymentPath = path.join(__dirname, "../deployment.local.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  // Connect to contracts
  const XGENMonitor = await ethers.getContractFactory("XGENMonitor");
  const monitor = XGENMonitor.attach(deployment.Monitor);

  console.log("\nStarting XIO Token monitoring...");
  console.log("=================================");

  // Monitor events in real-time
  monitor.on("TokenTransfer", (from, to, amount, timestamp) => {
    console.log("\nToken Transfer Detected:");
    console.log(`From: ${from}`);
    console.log(`To: ${to}`);
    console.log(`Amount: ${ethers.utils.formatEther(amount)} XGEN`);
    console.log(`Time: ${new Date(timestamp * 1000).toLocaleString()}`);
  });

  // Regular metrics polling
  setInterval(async () => {
    try {
      const metrics = await monitor.getTokenMetrics();
      console.log("\nCurrent Token Metrics:");
      console.log("=====================");
      console.log(`Total Supply: ${ethers.utils.formatEther(metrics.totalSupply)} XGEN`);
      console.log(`Total Sold: ${ethers.utils.formatEther(metrics.totalSold)} XGEN`);
      console.log(`Vesting Balance: ${ethers.utils.formatEther(metrics.vestingBalance)} XGEN`);
      
      const lastTransfer = await monitor.getLastTransfer();
      console.log("\nLast Transfer:");
      console.log(`From: ${lastTransfer.from}`);
      console.log(`To: ${lastTransfer.to}`);
      console.log(`Amount: ${ethers.utils.formatEther(lastTransfer.amount)} XGEN`);
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  }, 10000); // Poll every 10 seconds

  console.log("\nMonitoring system active. Press Ctrl+C to stop.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});