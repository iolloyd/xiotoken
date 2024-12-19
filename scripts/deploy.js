const hre = require("hardhat");
const { ethers, network } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("Starting deployment on network:", network.name);

  // Get deployment parameters from environment
  const totalSupply = ethers.utils.parseEther(process.env.TOTAL_SUPPLY || "1000000000");
  const seedRoundAllocation = ethers.utils.parseEther(process.env.SEED_ROUND_ALLOCATION || "100000000");
  const tokenPrice = process.env.TOKEN_PRICE || "1000000000000000";

  // Get role addresses from environment
  const adminAddress = process.env.ADMIN_ADDRESS;
  const pauserAddress = process.env.PAUSER_ADDRESS;
  const minterAddress = process.env.MINTER_ADDRESS;
  const configuratorAddress = process.env.CONFIGURATOR_ADDRESS;

  // Validate addresses
  if (!adminAddress || !ethers.utils.isAddress(adminAddress)) {
    throw new Error("Invalid admin address");
  }
  if (!pauserAddress || !ethers.utils.isAddress(pauserAddress)) {
    throw new Error("Invalid pauser address");
  }
  if (!minterAddress || !ethers.utils.isAddress(minterAddress)) {
    throw new Error("Invalid minter address");
  }
  if (!configuratorAddress || !ethers.utils.isAddress(configuratorAddress)) {
    throw new Error("Invalid configurator address");
  }

  console.log("\nDeployment Parameters:");
  console.log("=====================");
  console.log(`Total Supply: ${ethers.utils.formatEther(totalSupply)} XGEN`);
  console.log(`Seed Round Allocation: ${ethers.utils.formatEther(seedRoundAllocation)} XGEN`);
  console.log(`Token Price: ${tokenPrice} wei`);
  console.log(`Admin Address: ${adminAddress}`);
  console.log(`Pauser Address: ${pauserAddress}`);
  console.log(`Minter Address: ${minterAddress}`);
  console.log(`Configurator Address: ${configuratorAddress}`);
  console.log("=====================\n");

  // Deploy XGEN token
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

  // Verify contract if not on local network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    // Wait for fewer confirmations on testnet
    const confirmations = network.name.includes("goerli") ? 3 : 6;
    console.log(`Waiting for ${confirmations} block confirmations...`);
    await xgen.deployTransaction.wait(confirmations);

    console.log("Verifying contract on BaseScan...");
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
