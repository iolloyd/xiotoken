const hre = require("hardhat");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.name === 'base') {
    // Deploy XGEN on Base
    const XGEN = await hre.ethers.getContractFactory("XGEN");
    const xgen = await XGEN.deploy();
    await xgen.deployed();
    console.log("XGEN deployed to:", xgen.address);
  } else if (network.name === 'hyperliquid') {
    // Deploy XIO on Hyperliquid
    const XIO = await hre.ethers.getContractFactory("XIO");
    const xio = await XIO.deploy();
    await xio.deployed();
    console.log("XIO deployed to:", xio.address);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});