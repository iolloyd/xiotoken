// scripts/setup_local_env.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Setting up local test environment...");

  // Get test accounts
  const [deployer, treasury, user1, user2, user3] = await ethers.getSigners();
  
  console.log("\nTest Accounts:");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Treasury: ${treasury.address}`);
  console.log(`User1: ${user1.address}`);
  console.log(`User2: ${user2.address}`);
  console.log(`User3: ${user3.address}`);

  try {
    // Deploy tokens first
    console.log("\nDeploying XIO Token...");
    const XIO = await ethers.getContractFactory("XIO");
    const xio = await XIO.deploy(
      ethers.utils.parseEther("100000"),  // _rateLimitAmount: 100K tokens per period
      86400,                              // _rateLimitPeriod: 1 day
      treasury.address                    // _emergencyRecovery
    );
    await xio.deployed();
    console.log(`XIO Token deployed to: ${xio.address}`);

    console.log("\nDeploying XGEN Token...");
    const XGEN = await ethers.getContractFactory("XGEN");
    const xgen = await XGEN.deploy(
      "XGEN Token",                       // name
      "XGEN",                            // symbol
      ethers.utils.parseEther("1000000"), // _totalSupply: 1M total supply
      ethers.utils.parseEther("500000"),  // _seedAllocation: 500K seed allocation
      ethers.utils.parseEther("0.001"),   // _tokenPrice: 0.001 ETH per token
      ethers.utils.parseEther("100000"),  // _rateLimitAmount: 100K tokens per period
      86400                               // _rateLimitPeriod: 1 day
    );
    await xgen.deployed();
    console.log(`XGEN Token deployed to: ${xgen.address}`);

    // Configure rate limits for XIO token
    console.log("\nConfiguring XIO token rate limits...");
    const xioOperatorRole = await xio.OPERATOR_ROLE();
    await xio.updateRateLimitExemption(deployer.address, true);

    // Deploy KYC Contract
    console.log("\nDeploying KYC Contract...");
    const XGENKYC = await ethers.getContractFactory("XGENKYC");
    const kyc = await XGENKYC.deploy();
    await kyc.deployed();
    console.log(`KYC Contract deployed to: ${kyc.address}`);

    // Get current timestamp
    const currentTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const saleStartTime = currentTimestamp + 3600; // Start in 1 hour
    const saleEndTime = saleStartTime + 86400; // End in 24 hours
    const swapStartTime = saleEndTime + 3600; // 1 hour after sale ends

    // Deploy Vesting Contract
    console.log("\nDeploying Vesting Contract...");
    const XGENVesting = await ethers.getContractFactory("XGENVesting");
    const vesting = await XGENVesting.deploy(xgen.address);
    await vesting.deployed();
    console.log(`Vesting Contract deployed to: ${vesting.address}`);

    // Deploy Sale Contract
    console.log("\nDeploying Sale Contract...");
    const XGENSale = await ethers.getContractFactory("XGENSale");
    const sale = await XGENSale.deploy(
      xgen.address,
      vesting.address,
      saleStartTime,
      saleEndTime,
      ethers.utils.parseEther("0.001") // tokenPrice: 0.001 ETH per token
    );
    await sale.deployed();
    console.log(`Sale Contract deployed to: ${sale.address}`);

    // Deploy Token Swap Contract
    console.log("\nDeploying Token Swap Contract...");
    const TokenSwap = await ethers.getContractFactory("TokenSwap");
    const swapDuration = 604800; // 7 days
    const swapRateLimit = ethers.utils.parseEther("100000"); // 100K tokens per period
    const swapRatePeriod = 86400; // 1 day

    const swap = await TokenSwap.deploy(
      xgen.address,           // XGEN token address
      xio.address,            // XIO token address
      swapStartTime,          // Swap start time
      swapDuration,          // Swap duration
      swapRateLimit,         // Rate limit amount
      swapRatePeriod,        // Rate limit period
      treasury.address        // Emergency recovery address
    );
    await swap.deployed();
    console.log(`Swap Contract deployed to: ${swap.address}`);

    // Configure rate limit exemption for swap contract
    await xio.updateRateLimitExemption(swap.address, true);

    // Deploy Monitor Contract
    console.log("\nDeploying Monitor Contract...");
    const XGENMonitor = await ethers.getContractFactory("XGENMonitor");
    const monitor = await XGENMonitor.deploy(
      xgen.address,
      sale.address,
      vesting.address
    );
    await monitor.deployed();
    console.log(`Monitor Contract deployed to: ${monitor.address}`);

    // Setup initial state
    console.log("\nSetting up initial state...");

    // Set up whitelists and exemptions
    console.log("Setting up whitelists and exemptions...");
    await xgen.batchUpdateWhitelist(
      [
        deployer.address,
        treasury.address,
        user1.address,
        user2.address,
        sale.address,
        vesting.address,
        swap.address
      ],
      [true, true, true, true, true, true, true]
    );

    // Set high rate limit temporarily for XGEN token
    console.log("Configuring XGEN rate limits...");
    await xgen.updateRateLimit(
      ethers.utils.parseEther("1000000"), // Temporarily set very high rate limit
      86400 // 1 day
    );

    // Transfer initial tokens
    console.log("\nTransferring initial tokens...");
    
    // Transfer XGEN tokens to sale contract
    console.log("Transferring XGEN tokens to sale contract...");
    await xgen.transfer(sale.address, ethers.utils.parseEther("500000")); // 500K tokens for sale
    console.log("XGEN tokens transferred to sale contract");
    
    // Transfer XIO tokens to swap contract
    console.log("Transferring XIO tokens to swap contract...");
    await xio.transfer(swap.address, ethers.utils.parseEther("1000000")); // 1M tokens for swap
    console.log("XIO tokens transferred to swap contract");

    // Reset rate limits back to normal
    console.log("\nResetting rate limits...");
    await xgen.updateRateLimit(
      ethers.utils.parseEther("100000"), // Reset to normal rate limit
      86400 // 1 day
    );

    // Setup KYC for test users
    console.log("\nSetting up KYC for test users...");

    // Submit KYC requests for test users and get the request IDs from events
    console.log("Submitting KYC requests...");
    const tx1 = await kyc.connect(user1).submitKYCRequest('TEST_DOC_HASH_1');
    const receipt1 = await tx1.wait();
    const requestId1 = receipt1.events[0].args.requestId;

    const tx2 = await kyc.connect(user2).submitKYCRequest('TEST_DOC_HASH_2');
    const receipt2 = await tx2.wait();
    const requestId2 = receipt2.events[0].args.requestId;

    console.log("KYC requests submitted, approving...");
    // Approve KYC requests (1 year validity)
    await kyc.approveKYC(requestId1, "STANDARD", 365 * 24 * 60 * 60);
    await kyc.approveKYC(requestId2, "STANDARD", 365 * 24 * 60 * 60);
    console.log("KYC requests approved");

    // Save deployment addresses
    const deploymentInfo = {
      XGEN: xgen.address,
      XIO: xio.address,
      KYC: kyc.address,
      Sale: sale.address,
      Vesting: vesting.address,
      Swap: swap.address,
      Monitor: monitor.address,
      Treasury: treasury.address,
      TestUsers: {
        deployer: deployer.address,
        user1: user1.address,
        user2: user2.address,
        user3: user3.address
      }
    };

    const deploymentPath = path.join(__dirname, "../deployment.local.json");
    fs.writeFileSync(
      deploymentPath,
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log(`\nDeployment info saved to ${deploymentPath}`);
    
    console.log("\nInitial setup complete!");
    console.log("You can now run tests or interact with the contracts locally.");
  } catch (error) {
    console.error("\nError during deployment:");
    console.error(error.message);
    console.error("\nFull error:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });