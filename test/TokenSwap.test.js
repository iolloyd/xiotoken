const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenSwap", function () {
  let xgen;
  let xio;
  let tokenSwap;
  let owner;
  let user;
  let swapStartTime;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    const XGEN = await ethers.getContractFactory("XGEN");
    xgen = await XGEN.deploy();
    await xgen.deployed();

    const XIO = await ethers.getContractFactory("XIO");
    xio = await XIO.deploy();
    await xio.deployed();

    swapStartTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const TokenSwap = await ethers.getContractFactory("TokenSwap");
    tokenSwap = await TokenSwap.deploy(xgen.address, xio.address, swapStartTime);
    await tokenSwap.deployed();

    // Mint tokens for testing
    await xgen.mint(user.address, ethers.utils.parseEther("1000"));
    await xio.mint(tokenSwap.address, ethers.utils.parseEther("1000"));
  });

  describe("Swap", function () {
    it("Should not allow swaps before start time", async function () {
      await xgen.connect(user).approve(tokenSwap.address, ethers.utils.parseEther("100"));
      await expect(
        tokenSwap.connect(user).swap(ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Swap not started");
    });

    it("Should swap tokens at 1:1 ratio after start time", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [swapStartTime + 1]);
      await network.provider.send("evm_mine");

      const swapAmount = ethers.utils.parseEther("100");
      await xgen.connect(user).approve(tokenSwap.address, swapAmount);
      await tokenSwap.connect(user).swap(swapAmount);

      expect(await xio.balanceOf(user.address)).to.equal(swapAmount);
      expect(await xgen.balanceOf(tokenSwap.address)).to.equal(swapAmount);
    });

    it("Should fail if user has insufficient XGEN balance", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [swapStartTime + 1]);
      await network.provider.send("evm_mine");

      const largeAmount = ethers.utils.parseEther("2000");
      await xgen.connect(user).approve(tokenSwap.address, largeAmount);
      await expect(
        tokenSwap.connect(user).swap(largeAmount)
      ).to.be.reverted;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to pause and unpause", async function () {
      await tokenSwap.pause();
      await expect(
        tokenSwap.connect(user).swap(ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");

      await tokenSwap.unpause();
      await network.provider.send("evm_setNextBlockTimestamp", [swapStartTime + 1]);
      await network.provider.send("evm_mine");
      
      await xgen.connect(user).approve(tokenSwap.address, ethers.utils.parseEther("100"));
      await tokenSwap.connect(user).swap(ethers.utils.parseEther("100"));
    });

    it("Should allow admin to withdraw tokens", async function () {
      const amount = ethers.utils.parseEther("100");
      await tokenSwap.withdrawXIO(amount);
      expect(await xio.balanceOf(owner.address)).to.equal(amount);
    });
  });
});