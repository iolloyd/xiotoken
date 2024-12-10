const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XGEN", function () {
    let XGEN;
    let xgen;
    let owner;
    let addr1;
    let addr2;
    
    const TOTAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion tokens
    const SEED_ALLOCATION = ethers.utils.parseEther("100000000"); // 100 million tokens
    const TOKEN_PRICE = ethers.utils.parseEther("0.1"); // 0.1 ETH
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("100000"); // 100k tokens
    const RATE_LIMIT_PERIOD = 3600; // 1 hour

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        XGEN = await ethers.getContractFactory("XGEN");
        xgen = await XGEN.deploy(
            "XGEN Token",   // name
            "XGEN",        // symbol
            TOTAL_SUPPLY,
            SEED_ALLOCATION,
            TOKEN_PRICE,
            RATE_LIMIT_AMOUNT,
            RATE_LIMIT_PERIOD
        );
        await xgen.deployed();

        // Whitelist addresses for testing
        await xgen.updateWhitelist(owner.address, true);
        await xgen.updateWhitelist(addr1.address, true);
        await xgen.updateWhitelist(addr2.address, true);
    });

    describe("Deployment", function () {
        it("Should set the right token details", async function () {
            expect(await xgen.name()).to.equal("XGEN Token");
            expect(await xgen.symbol()).to.equal("XGEN");
            expect(await xgen.decimals()).to.equal(18);
            expect(await xgen.totalSupplyCap()).to.equal(TOTAL_SUPPLY);
            expect(await xgen.seedRoundAllocation()).to.equal(SEED_ALLOCATION);
            expect(await xgen.tokenPrice()).to.equal(TOKEN_PRICE);
            expect(await xgen.rateLimitAmount()).to.equal(RATE_LIMIT_AMOUNT);
            expect(await xgen.rateLimitPeriod()).to.equal(RATE_LIMIT_PERIOD);
        });

        it("Should assign the total supply to the owner", async function () {
            expect(await xgen.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
        });

        it("Should assign the correct roles", async function () {
            expect(await xgen.hasRole(await xgen.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await xgen.hasRole(await xgen.PAUSER_ROLE(), owner.address)).to.be.true;
            expect(await xgen.hasRole(await xgen.MINTER_ROLE(), owner.address)).to.be.true;
            expect(await xgen.hasRole(await xgen.CONFIGURATOR_ROLE(), owner.address)).to.be.true;
        });
    });

    describe("Transactions", function () {
        beforeEach(async function () {
            // Transfer tokens for testing
            await xgen.transfer(addr1.address, ethers.utils.parseEther("1000"));
        });

        it("Should transfer tokens between whitelisted accounts", async function () {
            await xgen.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("500"));
            expect(await xgen.balanceOf(addr2.address)).to.equal(ethers.utils.parseEther("500"));
        });

        it("Should fail to transfer to non-whitelisted accounts", async function () {
            await xgen.updateWhitelist(addr2.address, false);
            await expect(
                xgen.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("500"))
            ).to.be.revertedWithCustomError(xgen, "NotWhitelisted")
            .withArgs(addr1.address);
        });

        it("Should enforce rate limits", async function () {
            await expect(
                xgen.connect(addr1).transfer(addr2.address, RATE_LIMIT_AMOUNT.add(1))
            ).to.be.revertedWithCustomError(xgen, "RateLimitExceeded")
            .withArgs(addr1.address, addr2.address, RATE_LIMIT_AMOUNT.add(1));
        });
    });

    describe("Rate Limiting", function () {
        it("Should update rate limit parameters", async function () {
            const newAmount = ethers.utils.parseEther("200000");
            const newPeriod = 7200;
            
            await xgen.updateRateLimit(newAmount, newPeriod);
            
            expect(await xgen.rateLimitAmount()).to.equal(newAmount);
            expect(await xgen.rateLimitPeriod()).to.equal(newPeriod);
        });

        it("Should reset rate limit after period", async function () {
            await xgen.transfer(addr1.address, RATE_LIMIT_AMOUNT);
            
            // Increase time by rate limit period
            await ethers.provider.send("evm_increaseTime", [RATE_LIMIT_PERIOD]);
            await ethers.provider.send("evm_mine");
            
            // Should allow another transfer up to limit
            await xgen.transfer(addr1.address, RATE_LIMIT_AMOUNT);
        });
    });

    describe("Access Control", function () {
        it("Should restrict administrative functions", async function () {
            await expect(
                xgen.connect(addr1).updateTokenPrice(ethers.utils.parseEther("0.2"))
            ).to.be.reverted;
            
            await expect(
                xgen.connect(addr1).updateRateLimit(1, 1)
            ).to.be.reverted;
            
            await expect(
                xgen.connect(addr1).pause()
            ).to.be.reverted;
        });

        it("Should allow admin to update parameters", async function () {
            const newPrice = ethers.utils.parseEther("0.2");
            await xgen.updateTokenPrice(newPrice);
            expect(await xgen.tokenPrice()).to.equal(newPrice);
            
            const newLimits = {
                min: ethers.utils.parseEther("1"),
                max: ethers.utils.parseEther("10")
            };
            await xgen.updateInvestmentLimits(newLimits.min, newLimits.max);
            expect(await xgen.minInvestment()).to.equal(newLimits.min);
            expect(await xgen.maxInvestment()).to.equal(newLimits.max);
        });
    });
});