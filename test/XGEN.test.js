const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XGEN", function () {
  let xgen;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const XGEN = await ethers.getContractFactory("XGEN");
    xgen = await XGEN.deploy();
    await xgen.deployed();
  });

  describe("Deployment", function () {
    it("Should assign the right roles", async function () {
      expect(await xgen.hasRole(await xgen.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await xgen.hasRole(await xgen.PAUSER_ROLE(), owner.address)).to.equal(true);
      expect(await xgen.hasRole(await xgen.MINTER_ROLE(), owner.address)).to.equal(true);
    });
  });

  describe("Minting", function () {
    it("Should mint tokens by minter role", async function () {
      await xgen.mint(addr1.address, 100);
      expect(await xgen.balanceOf(addr1.address)).to.equal(100);
    });

    it("Should fail if non-minter tries to mint", async function () {
      await expect(
        xgen.connect(addr1).mint(addr2.address, 100)
      ).to.be.reverted;
    });
  });

  describe("Pausing", function () {
    it("Should pause and unpause", async function () {
      await xgen.pause();
      await expect(xgen.transfer(addr1.address, 100)).to.be.reverted;
      await xgen.unpause();
      await xgen.mint(owner.address, 100);
      await xgen.transfer(addr1.address, 100);
      expect(await xgen.balanceOf(addr1.address)).to.equal(100);
    });
  });

  describe("Burning", function () {
    it("Should burn tokens", async function () {
      await xgen.mint(addr1.address, 100);
      await xgen.connect(addr1).burn(50);
      expect(await xgen.balanceOf(addr1.address)).to.equal(50);
    });
  });
});