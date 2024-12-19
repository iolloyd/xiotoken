const hre = require("hardhat");
const { ethers, network } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("Starting Fjord Foundry deployment on network:", network.name);

  // Get deployment parameters from environment
  const totalSupply = ethers.utils.parseEther(process.env.TOTAL_SUPPLY || "1000000000");
  const seedRoundAllocation = ethers.utils.parseEther(process.env.SEED_ROUND_ALLOCATION || "100000000");
  const tokenPrice = process.env.TOKEN_PRICE || "1000000000000000"; // 0.001 ETH

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

  // Get role addresses from environment or use deployer as default
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;
  const pauserAddress = process.env.PAUSER_ADDRESS || deployer.address;
  const minterAddress = process.env.MINTER_ADDRESS || deployer.address;
  const configuratorAddress = process.env.CONFIGURATOR_ADDRESS || deployer.address;

  console.log("\nDeployment Parameters:");
  console.log("=====================");
  console.log(`Total Supply: ${ethers.utils.formatEther(totalSupply)} XGEN`);
  console.log(`Seed Round Allocation: ${ethers.utils.formatEther(seedRoundAllocation)} XGEN`);
  console.log(`Token Price: ${ethers.utils.formatUnits(tokenPrice, "gwei")} gwei`);
  console.log(`Admin Address: ${adminAddress}`);
  console.log(`Pauser Address: ${pauserAddress}`);
  console.log(`Minter Address: ${minterAddress}`);
  console.log(`Configurator Address: ${configuratorAddress}`);
  console.log("=====================\n");

  // Deploy XGEN token
  console.log("Deploying XGEN token...");
  const XGEN = await ethers.getContractFactory("XGEN");
  const xgen = await XGEN.deploy(
    "XGEN Token",
    "XGEN",
    totalSupply,
    seedRoundAllocation,
    tokenPrice,
    adminAddress,
    pauserAddress,
    minterAddress,
    configuratorAddress
  );

  await xgen.deployed();
  console.log("XGEN token deployed to:", xgen.address);

  // Wait for more confirmations on mainnet
  const confirmations = network.name === "base_mainnet" ? 5 : 3;
  console.log(`Waiting for ${confirmations} confirmations...`);
  await xgen.deployTransaction.wait(confirmations);

  // Verify contract
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerifying contract on BaseScan...");
    try {
      await hre.run("verify:verify", {
        address: xgen.address,
        constructorArguments: [
          "XGEN Token",
          "XGEN",
          totalSupply,
          seedRoundAllocation,
          tokenPrice,
          adminAddress,
          pauserAddress,
          minterAddress,
          configuratorAddress
        ],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.error("Verification error:", error.message);
      console.log("You may need to verify manually or retry verification in a few minutes");
    }
  }

  // Log deployment summary
  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("Network:", network.name);
  console.log("XGEN Token:", xgen.address);
  console.log("Block number:", await ethers.provider.getBlockNumber());
  console.log("===================");

  // Log role assignments
  console.log("\nRole Assignments:");
  console.log("================");
  console.log("Admin:", await xgen.hasRole(await xgen.DEFAULT_ADMIN_ROLE(), adminAddress));
  console.log("Pauser:", await xgen.hasRole(await xgen.PAUSER_ROLE(), pauserAddress));
  console.log("Minter:", await xgen.hasRole(await xgen.MINTER_ROLE(), minterAddress));
  console.log("Configurator:", await xgen.hasRole(await xgen.CONFIGURATOR_ROLE(), configuratorAddress));
  console.log("================");

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    token: {
      address: xgen.address,
      name: "XGEN Token",
      symbol: "XGEN",
      totalSupply: totalSupply.toString(),
      seedRoundAllocation: seedRoundAllocation.toString(),
      tokenPrice: tokenPrice
    },
    roles: {
      admin: adminAddress,
      pauser: pauserAddress,
      minter: minterAddress,
      configurator: configuratorAddress
    },
    deployment: {
      deployer: deployer.address,
      blockNumber: await ethers.provider.getBlockNumber(),
      timestamp: Math.floor(Date.now() / 1000)
    }
  };

  // Write deployment info to file
  const fs = require('fs');
  const deploymentPath = `deployments/${network.name}.json`;
  fs.mkdirSync('deployments', { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 