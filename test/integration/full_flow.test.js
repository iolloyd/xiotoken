// test/integration/full_flow.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const MockFjordFoundry = require("../../scripts/mock_fjord");

describe("XIO Token Full Flow", function() {
  let xgen, kyc, sale, vesting, swap, monitor;
  let deployer, treasury, user1, user2, user3;
  let mockFjord;

  before(async function() {
    // Get test accounts
    [deployer, treasury, user1, user2, user3] = await ethers.getSigners();

    // Deploy contracts
    const XGEN = await ethers.getContractFactory("XGEN");
    xgen = await XGEN.deploy(
      "XIO Genesis Token",
      "XGEN",
      ethers.utils.parseEther("1000000")
    );

    const XGENKYC = await ethers.getContractFactory("XGENKYC");
    kyc = await XGENKYC.deploy();

    const XGENSale = await ethers.getContractFactory("XGENSale");
    sale = await XGENSale.deploy(
      xgen.address,
      kyc.address,
      treasury.address,
      ethers.utils.parseEther("0.001")
    );

    const XGENVesting = await ethers.getContractFactory("XGENVesting");
    vesting = await XGENVesting.deploy(xgen.address);

    const TokenSwap = await ethers.getContractFactory("TokenSwap");
    swap = await TokenSwap.deploy(xgen.address);

    const XGENMonitor = await ethers.getContractFactory("XGENMonitor");
    monitor = await XGENMonitor.deploy(
      xgen.address,
      sale.address,
      vesting.address
    );

    // Initialize mock Fjord Foundry
    mockFjord = new MockFjordFoundry(sale, xgen, kyc);

    // Transfer tokens to sale contract
    await xgen.transfer(sale.address, ethers.utils.parseEther("500000"));

    // Setup for testing
    await kyc.grantRole(await kyc.DEFAULT_ADMIN_ROLE(), deployer.address);
  });

  describe("1. Pre-sale Setup", function() {
    it("Should set up KYC whitelist", async function() {
      await kyc.addToWhitelist([user1.address, user2.address]);
      
      expect(await kyc.isWhitelisted(user1.address)).to.be.true;
      expect(await kyc.isWhitelisted(user2.address)).to.be.true;
      expect(await kyc.isWhitelisted(user3.address)).to.be.false;
    });

    it("Should set up sale parameters", async function() {
      await mockFjord.setupSale();
      const status = await mockFjord.getSaleStatus();
      
      expect(status.isActive).to.be.false; // Not started yet
      expect(parseFloat(status.hardCap)).to.equal(500000);
    });

    it("Should have correct initial token allocations", async function() {
      const saleBalance = await xgen.balanceOf(sale.address);
      expect(saleBalance).to.equal(ethers.utils.parseEther("500000"));
    });
  });

  describe("2. Token Sale Process", function() {
    before(async function() {
      // Fast forward to sale start
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
    });

    it("Should allow whitelisted users to participate", async function() {
      const purchaseAmount = ethers.utils.parseEther("1"); // 1 ETH
      const beforeBalance = await xgen.balanceOf(user1.address);
      
      await mockFjord.participate(user1, purchaseAmount);

      const afterBalance = await xgen.balanceOf(user1.address);
      expect(afterBalance.sub(beforeBalance)).to.equal(
        ethers.utils.parseEther("1000")
      ); // 1 ETH = 1000 XGEN at 0.001 ETH/XGEN
    });

    it("Should reject non-whitelisted users", async function() {
      const purchaseAmount = ethers.utils.parseEther("1");
      await expect(
        mockFjord.participate(user3, purchaseAmount)
      ).to.be.revertedWith("User not whitelisted");
    });

    it("Should enforce minimum and maximum purchase limits", async function() {
      const tooSmall = ethers.utils.parseEther("0.05"); // Below min
      const tooLarge = ethers.utils.parseEther("11"); // Above max

      await expect(
        mockFjord.participate(user2, tooSmall)
      ).to.be.revertedWith("Amount below minimum");

      await expect(
        mockFjord.participate(user2, tooLarge)
      ).to.be.revertedWith("Amount above maximum");
    });

    it("Should track sale progress correctly", async function() {
      const status = await mockFjord.getSaleStatus();
      expect(parseFloat(status.totalSold)).to.be.greaterThan(0);
      expect(status.isActive).to.be.true;
    });
  });

  describe("3. Post-sale Token Swap", function() {
    let xio;

    before(async function() {
      // End the sale
      await mockFjord.endSale();
      
      // Deploy XIO token
      const XIO = await ethers.getContractFactory("XIO");
      xio = await XIO.deploy(
        "XIO Token",
        "XIO",
        ethers.utils.parseEther("1000000")
      );
      await xio.deployed();
    });

    it("Should configure swap contract correctly", async function() {
      await swap.setXIOToken(xio.address);
      const configuredXIO = await swap.xioToken();
      expect(configuredXIO).to.equal(xio.address);
    });

    it("Should allow XGEN holders to swap for XIO", async function() {
      const xgenBalance = await xgen.balanceOf(user1.address);
      
      // Transfer XIO tokens to swap contract
      await xio.transfer(swap.address, xgenBalance);

      // Approve tokens for swap
      await xgen.connect(user1).approve(swap.address, xgenBalance);

      // Perform swap
      await swap.connect(user1).swapXGENforXIO();

      // Check balances
      const finalXIOBalance = await xio.balanceOf(user1.address);
      const finalXGENBalance = await xgen.balanceOf(user1.address);

      expect(finalXIOBalance).to.equal(xgenBalance);
      expect(finalXGENBalance).to.equal(0);
    });
  });

  describe("4. Token Vesting and Monitoring", function() {
    it("Should set up and execute vesting schedules", async function() {
      const vestingAmount = ethers.utils.parseEther("100000");
      const now = Math.floor(Date.now() / 1000);
      
      await xgen.transfer(vesting.address, vestingAmount);
      
      await vesting.createVestingSchedule(
        treasury.address,
        now, // start time
        2592000, // 30 days cliff
        7776000, // 90 days total duration
        86400, // 1 day release interval
        vestingAmount
      );

      // Fast forward 45 days
      await ethers.provider.send("evm_increaseTime", [3888000]);
      await ethers.provider.send("evm_mine");

      const vestedAmount = await vesting.getVestedAmount(treasury.address);
      expect(vestedAmount).to.be.gt(0);
      
      // Claim vested tokens
      await vesting.connect(treasury).claim();
      const treasuryBalance = await xgen.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(vestedAmount);
    });

    it("Should track token metrics correctly", async function() {
      const metrics = await monitor.getTokenMetrics();
      
      expect(metrics.totalSupply).to.equal(ethers.utils.parseEther("1000000"));
      expect(metrics.totalSold).to.be.gt(0);
      expect(metrics.vestingBalance).to.be.gt(0);
    });

    it("Should monitor token transfers", async function() {
      const transferAmount = ethers.utils.parseEther("100");
      await xgen.connect(treasury).transfer(user2.address, transferAmount);
      
      const lastTransfer = await monitor.getLastTransfer();
      expect(lastTransfer.from).to.equal(treasury.address);
      expect(lastTransfer.to).to.equal(user2.address);
      expect(lastTransfer.amount).to.equal(transferAmount);
    });
  });
});