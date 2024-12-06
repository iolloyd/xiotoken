// scripts/mock_fjord.js
const { ethers } = require("hardhat");

class MockFjordFoundry {
  constructor(saleContract, xgenToken, kycContract) {
    this.saleContract = saleContract;
    this.xgenToken = xgenToken;
    this.kycContract = kycContract;
  }

  async setupSale({
    startTime = Math.floor(Date.now() / 1000) + 3600, // Start in 1 hour
    duration = 86400, // 24 hours
    hardCap = ethers.utils.parseEther("500000"),
    tokenPrice = ethers.utils.parseEther("0.001"),
    minPurchase = ethers.utils.parseEther("0.1"),
    maxPurchase = ethers.utils.parseEther("10")
  } = {}) {
    console.log("Setting up mock Fjord Foundry sale...");

    await this.saleContract.configure(
      startTime,
      duration,
      hardCap,
      tokenPrice,
      minPurchase,
      maxPurchase
    );

    console.log({
      startTime,
      duration,
      hardCap: hardCap.toString(),
      tokenPrice: tokenPrice.toString(),
      minPurchase: minPurchase.toString(),
      maxPurchase: maxPurchase.toString()
    });
  }

  async participate(user, amount) {
    console.log(`User ${user.address} participating with ${amount} ETH`);
    
    // Check KYC
    const isWhitelisted = await this.kycContract.isWhitelisted(user.address);
    if (!isWhitelisted) {
      throw new Error("User not whitelisted");
    }

    // Calculate tokens
    const tokenPrice = await this.saleContract.tokenPrice();
    const tokenAmount = amount.mul(ethers.constants.WeiPerEther).div(tokenPrice);

    // Participate in sale
    const tx = await this.saleContract.connect(user).participate({
      value: amount
    });
    await tx.wait();

    console.log(`Purchased ${ethers.utils.formatEther(tokenAmount)} XGEN tokens`);
    return tokenAmount;
  }

  async getSaleStatus() {
    const [
      startTime,
      endTime,
      hardCap,
      tokenPrice,
      totalSold,
      isActive
    ] = await Promise.all([
      this.saleContract.startTime(),
      this.saleContract.endTime(),
      this.saleContract.hardCap(),
      this.saleContract.tokenPrice(),
      this.saleContract.totalSold(),
      this.saleContract.isActive()
    ]);

    return {
      startTime: startTime.toString(),
      endTime: endTime.toString(),
      hardCap: ethers.utils.formatEther(hardCap),
      tokenPrice: ethers.utils.formatEther(tokenPrice),
      totalSold: ethers.utils.formatEther(totalSold),
      isActive
    };
  }

  async endSale() {
    console.log("Ending sale...");
    await this.saleContract.endSale();
    console.log("Sale ended");
  }
}

module.exports = MockFjordFoundry;