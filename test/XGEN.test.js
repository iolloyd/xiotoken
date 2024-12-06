const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("XGEN", function () {
  let xgen;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const XGEN = await ethers.getContractFactory("XGEN");
    xgen = await XGEN.deploy();
    await xgen.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right token details", async function () {
      expect(await xgen.name()).to.equal("XGEN Token");
      expect(await xgen.symbol()).to.equal("XGEN");
      expect(await xgen.decimals()).to.equal(18);
    });

    it("Should assign the right roles", async function () {
      const DEFAULT_ADMIN_ROLE = await xgen.DEFAULT_ADMIN_ROLE();
      const PAUSER_ROLE = await xgen.PAUSER_ROLE();
      const MINTER_ROLE = await xgen.MINTER_ROLE();
      const CONFIGURATOR_ROLE = await xgen.CONFIGURATOR_ROLE();

      expect(await xgen.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await xgen.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      expect(await xgen.hasRole(MINTER_ROLE, owner.address)).to.be.true;
      expect(await xgen.hasRole(CONFIGURATOR_ROLE, owner.address)).to.be.true;
    });

    it("Should set correct supply parameters", async function () {
      const totalSupply = await xgen.TOTAL_SUPPLY();
      const seedRoundAllocation = await xgen.SEED_ROUND_ALLOCATION();
      expect(totalSupply).to.equal(ethers.utils.parseEther("100000000"));
      expect(seedRoundAllocation).to.equal(ethers.utils.parseEther("10000000"));
    });
  });

  describe("Role Management", function () {
    it("Should allow admin to grant and revoke roles", async function () {
      const MINTER_ROLE = await xgen.MINTER_ROLE();
      await xgen.grantRole(MINTER_ROLE, addr1.address);
      expect(await xgen.hasRole(MINTER_ROLE, addr1.address)).to.be.true;

      await xgen.revokeRole(MINTER_ROLE, addr1.address);
      expect(await xgen.hasRole(MINTER_ROLE, addr1.address)).to.be.false;
    });

    it("Should prevent non-admin from granting roles", async function () {
      const MINTER_ROLE = await xgen.MINTER_ROLE();
      await expect(
        xgen.connect(addr1).grantRole(MINTER_ROLE, addr2.address)
      ).to.be.revertedWith("AccessControl:");
    });
  });

  describe("Whitelisting", function () {
    it("Should allow configurator to update whitelist", async function () {
      await xgen.updateWhitelist(addr1.address, true);
      expect(await xgen.whitelist(addr1.address)).to.be.true;
    });

    it("Should allow batch whitelist updates", async function () {
      const addresses = [addr1.address, addr2.address];
      const statuses = [true, true];
      await xgen.batchUpdateWhitelist(addresses, statuses);
      
      expect(await xgen.whitelist(addr1.address)).to.be.true;
      expect(await xgen.whitelist(addr2.address)).to.be.true;
    });

    it("Should emit WhitelistUpdated event", async function () {
      await expect(xgen.updateWhitelist(addr1.address, true))
        .to.emit(xgen, "WhitelistUpdated")
        .withArgs(addr1.address, true);
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      await xgen.updateWhitelist(addr1.address, true);
    });

    it("Should mint tokens to whitelisted address", async function () {
      await xgen.mint(addr1.address, ethers.utils.parseEther("100"));
      expect(await xgen.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("100"));
    });

    it("Should fail minting to non-whitelisted address", async function () {
      await expect(
        xgen.mint(addr2.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("XGEN: Address not whitelisted");
    });

    it("Should respect total supply cap", async function () {
      const totalSupply = await xgen.TOTAL_SUPPLY();
      await expect(
        xgen.mint(addr1.address, totalSupply.add(1))
      ).to.be.revertedWith("XGEN: Exceeds max supply");
    });
  });

  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      await xgen.updateWhitelist(addr1.address, true);
      await xgen.updateWhitelist(addr2.address, true);
      await xgen.mint(addr1.address, ethers.utils.parseEther("1000"));
    });

    it("Should allow transfers between whitelisted addresses", async function () {
      await xgen.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("100"));
      expect(await xgen.balanceOf(addr2.address)).to.equal(ethers.utils.parseEther("100"));
    });

    it("Should prevent transfers to non-whitelisted addresses", async function () {
      await expect(
        xgen.connect(addr1).transfer(addr3.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("XGEN: Address not whitelisted");
    });
  });

  describe("Rate Limiting", function () {
    beforeEach(async function () {
      await xgen.updateWhitelist(addr1.address, true);
      await xgen.updateWhitelist(addr2.address, true);
      await xgen.mint(addr1.address, ethers.utils.parseEther("1000000"));
    });

    it("Should enforce rate limit", async function () {
      const rateLimit = await xgen.RATE_LIMIT_AMOUNT();
      await xgen.connect(addr1).transfer(addr2.address, rateLimit);
      
      await expect(
        xgen.connect(addr1).transfer(addr2.address, 1)
      ).to.be.revertedWith("XGEN: Rate limit exceeded");
    });

    it("Should reset rate limit after period", async function () {
      const rateLimit = await xgen.RATE_LIMIT_AMOUNT();
      await xgen.connect(addr1).transfer(addr2.address, rateLimit);
      
      await time.increase(3600); // Increase time by 1 hour
      
      await xgen.connect(addr1).transfer(addr2.address, rateLimit);
      expect(await xgen.balanceOf(addr2.address)).to.equal(rateLimit.mul(2));
    });
  });

  describe("Pausing", function () {
    beforeEach(async function () {
      await xgen.updateWhitelist(addr1.address, true);
      await xgen.updateWhitelist(addr2.address, true);
      await xgen.mint(addr1.address, ethers.utils.parseEther("1000"));
    });

    it("Should pause all transfers", async function () {
      await xgen.pause();
      await expect(
        xgen.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should resume transfers after unpause", async function () {
      await xgen.pause();
      await xgen.unpause();
      await xgen.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("100"));
      expect(await xgen.balanceOf(addr2.address)).to.equal(ethers.utils.parseEther("100"));
    });

    it("Should only allow pauser to pause/unpause", async function () {
      await expect(
        xgen.connect(addr1).pause()
      ).to.be.revertedWith("AccessControl:");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await xgen.updateWhitelist(addr1.address, true);
      await xgen.mint(addr1.address, ethers.utils.parseEther("1000"));
    });

    it("Should allow token holders to burn their tokens", async function () {
      await xgen.connect(addr1).burn(ethers.utils.parseEther("500"));
      expect(await xgen.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("500"));
    });

    it("Should update total supply after burning", async function () {
      const initialSupply = await xgen.totalSupply();
      await xgen.connect(addr1).burn(ethers.utils.parseEther("500"));
      expect(await xgen.totalSupply()).to.equal(initialSupply.sub(ethers.utils.parseEther("500")));
    });
  });
});