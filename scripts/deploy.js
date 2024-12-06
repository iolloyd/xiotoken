const hre = require("hardhat");
const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("Starting deployment...");

  // Get deployment parameters from environment
  const totalSupply = ethers.utils.parseEther(process.env.TOTAL_SUPPLY || "100000000");
  const seedRoundAllocation = ethers.utils.parseEther(process.env.SEED_ROUND_ALLOCATION || "10000000");
  const tokenPrice = process.env.TOKEN_PRICE || "100000000";
  const rateLimitAmount = ethers.utils.parseEther(process.env.RATE_LIMIT_AMOUNT || "100000");
  const rateLimitPeriod = process.env.RATE_LIMIT_PERIOD || "3600";

  console.log("Deploying XGEN token with parameters:");
  console.log(`Total Supply: ${ethers.utils.formatEther(totalSupply)} XGEN`);
  console.log(`Seed Round Allocation: ${ethers.utils.formatEther(seedRoundAllocation)} XGEN`);
  console.log(`Token Price: ${tokenPrice} wei`);
  console.log(`Rate Limit Amount: ${ethers.utils.formatEther(rateLimitAmount)} XGEN`);
  console.log(`Rate Limit Period: ${rateLimitPeriod} seconds`);

  // Deploy XGEN token
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

  // Set up roles if specified in environment
  const adminAddresses = (process.env.ADMIN_ADDRESSES || "").split(",").filter(a => a);
  const pauserAddresses = (process.env.PAUSER_ADDRESSES || "").split(",").filter(a => a);
  const minterAddresses = (process.env.MINTER_ADDRESSES || "").split(",").filter(a => a);

  // Get role identifiers
  const DEFAULT_ADMIN_ROLE = await xgen.DEFAULT_ADMIN_ROLE();
  const PAUSER_ROLE = await xgen.PAUSER_ROLE();
  const MINTER_ROLE = await xgen.MINTER_ROLE();

  // Grant roles
  for (const admin of adminAddresses) {
    console.log(`Granting admin role to ${admin}`);
    await xgen.grantRole(DEFAULT_ADMIN_ROLE, admin);
  }

  for (const pauser of pauserAddresses) {
    console.log(`Granting pauser role to ${pauser}`);
    await xgen.grantRole(PAUSER_ROLE, pauser);
  }

  for (const minter of minterAddresses) {
    console.log(`Granting minter role to ${minter}`);
    await xgen.grantRole(MINTER_ROLE, minter);
  }

  console.log("Initial setup complete");

  // Verify contract if not on local network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await xgen.deployTransaction.wait(6); // Wait for 6 block confirmations

    console.log("Verifying contract on Etherscan...");
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
  }

  console.log("Deployment completed successfully");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
