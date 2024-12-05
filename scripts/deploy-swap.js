const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Get deployed token addresses from environment or config
  const xgenAddress = process.env.XGEN_ADDRESS;
  const xioAddress = process.env.XIO_ADDRESS;
  
  if (!xgenAddress || !xioAddress) {
    throw new Error("Token addresses not configured");
  }

  // Set swap start time (3 days from now)
  const swapStartTime = Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60);

  // Deploy TokenSwap contract
  const TokenSwap = await hre.ethers.getContractFactory("TokenSwap");
  const swap = await TokenSwap.deploy(xgenAddress, xioAddress, swapStartTime);
  await swap.deployed();

  console.log("TokenSwap deployed to:", swap.address);
  console.log("Swap will start at:", new Date(swapStartTime * 1000).toISOString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});