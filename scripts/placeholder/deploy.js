const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const PlaceholderToken = await hre.ethers.getContractFactory("PlaceholderToken");
  const token = await PlaceholderToken.deploy();

  await token.deployed();

  console.log("PlaceholderToken deployed to:", token.address);
  
  // Verify the contract if on a supported network
  try {
    await hre.run("verify:verify", {
      address: token.address,
      constructorArguments: [],
    });
    console.log("Contract verified");
  } catch (error) {
    console.log("Verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });