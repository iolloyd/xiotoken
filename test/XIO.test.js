const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("XIO Token", function () {
    let XIO;
    let xio;
    let owner;
    let addr1;
    let addr2;
    let emergencyRecovery;
    
    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion tokens
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("100000"); // 100k tokens
    const RATE_LIMIT_PERIOD = 3600; // 1 hour
    const QUARTERLY_BURN_INTERVAL = 90 * 24 * 3600; // 90 days

    beforeEach(async function () {
        [owner, addr1, addr2, emergencyRecovery] = await ethers.getSigners();
        
        XIO = await ethers.getContractFactory("XIO");
        xio = await XIO.deploy(
            RATE_LIMIT_AMOUNT,
            RATE_LIMIT_PERIOD,
            emergencyRecovery.address
        );
        await xio.deployed();

        // Update rate limit exemptions
        await xio.updateRateLimitExemption(owner.address, true);
        await xio.updateRateLimitExemption(addr1.address, true);
        await xio.updateRateLimitExemption(emergencyRecovery.address, true);

        // Transfer tokens for testing
        await xio.transfer(addr1.address, ethers.utils.parseEther("1000000"));
    });

    describe("Deployment", function () {
        it("Should set the right token details", async function () {
            expect(await xio.name()).to.equal("XIO Token");
            expect(await xio.symbol()).to.equal("XIO");
            expect(await xio.decimals()).to.equal(18);
        });

        it("Should assign the initial supply correctly", async function () {
            const totalSupply = ethers.utils.parseEther("1000000000"); // 1 billion tokens
            const ownerBalance = await xio.balanceOf(owner.address);
            const transferredAmount = ethers.utils.parseEther("1000000");
            expect(ownerBalance).to.equal(totalSupply.sub(transferredAmount));
        });

        it("Should set the correct roles", async function () {
            expect(await xio.hasRole(await xio.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await xio.hasRole(await xio.PAUSER_ROLE(), owner.address)).to.be.true;
            expect(await xio.hasRole(await xio.MINTER_ROLE(), owner.address)).to.be.true;
            expect(await xio.hasRole(await xio.OPERATOR_ROLE(), owner.address)).to.be.true;
            expect(await xio.hasRole(await xio.GOVERNANCE_ROLE(), owner.address)).to.be.true;
        });

        it("Should set the correct rate limit parameters", async function () {
            expect(await xio.rateLimitAmount()).to.equal(RATE_LIMIT_AMOUNT);
            expect(await xio.rateLimitPeriod()).to.equal(RATE_LIMIT_PERIOD);
        });
    });

    describe("Rate Limiting", function () {
        beforeEach(async function () {
            // Remove rate limit exemption for testing
            await xio.updateRateLimitExemption(addr1.address, false);
        });

        it("Should enforce rate limits on transfers", async function () {
            const amount = RATE_LIMIT_AMOUNT.add(1);
            await expect(
                xio.connect(addr1).transfer(addr2.address, amount)
            ).to.be.revertedWith("XIO: Rate limit exceeded");
        });

        it("Should allow transfers within rate limit", async function () {
            const amount = RATE_LIMIT_AMOUNT;
            await xio.connect(addr1).transfer(addr2.address, amount);
            expect(await xio.balanceOf(addr2.address)).to.equal(amount);
        });

        it("Should reset rate limit after period", async function () {
            // First transfer up to limit
            await xio.connect(addr1).transfer(addr2.address, RATE_LIMIT_AMOUNT);
            
            // Increase time past rate limit period
            await time.increase(RATE_LIMIT_PERIOD + 1);
            
            // Should allow another transfer up to limit
            await xio.connect(addr1).transfer(addr2.address, RATE_LIMIT_AMOUNT);
            
            expect(await xio.balanceOf(addr2.address)).to.equal(RATE_LIMIT_AMOUNT.mul(2));
        });
    });

    describe("Burn Mechanics", function () {
        it("Should enforce quarterly burn interval", async function () {
            const burnAmount = ethers.utils.parseEther("1000");
            
            // First burn should succeed (initializes the burn cycle)
            await xio.executeQuarterlyBurn(burnAmount);
            
            // Immediate second burn should fail
            await expect(
                xio.executeQuarterlyBurn(burnAmount)
            ).to.be.revertedWith("XIO: Too early for burn");

            // Move time forward but not enough
            await time.increase(QUARTERLY_BURN_INTERVAL - 60);  // 1 minute short
            await expect(
                xio.executeQuarterlyBurn(burnAmount)
            ).to.be.revertedWith("XIO: Too early for burn");

            // Move past the interval
            await time.increase(120);  // Move 2 minutes forward
            await xio.executeQuarterlyBurn(burnAmount);

            const burnStats = await xio.getBurnStats();
            expect(burnStats.totalBurnt).to.equal(burnAmount.mul(2));
        });

        it("Should enforce maximum burn limit", async function () {
            const maxBurnSupply = await xio.MAX_BURN_SUPPLY();
            
            await expect(
                xio.executeQuarterlyBurn(maxBurnSupply.add(1))
            ).to.be.revertedWith("XIO: Exceeds burn limit");
            
            // Should allow burn up to max limit
            await xio.executeQuarterlyBurn(maxBurnSupply);
            const burnStats = await xio.getBurnStats();
            expect(burnStats.totalBurnt).to.equal(maxBurnSupply);
        });
    });

    describe("Emergency Controls", function () {
        it("Should activate emergency mode correctly", async function () {
            await xio.initiateEmergencyMode();
            expect(await xio.emergencyMode()).to.be.true;
            const expectedTimestamp = (await time.latest()) + 24 * 3600;
            expect(await xio.emergencyActionTimestamp()).to.equal(expectedTimestamp);
        });

        it("Should update emergency recovery address", async function () {
            await xio.updateEmergencyRecovery(addr1.address);
            expect(await xio.emergencyRecoveryAddress()).to.equal(addr1.address);
        });

        it("Should enforce permission on emergency functions", async function () {
            await expect(
                xio.connect(addr1).initiateEmergencyMode()
            ).to.be.reverted;
            
            await expect(
                xio.connect(addr1).updateEmergencyRecovery(addr2.address)
            ).to.be.reverted;
        });
    });

    describe("Administrative Functions", function () {
        it("Should update rate limit parameters", async function () {
            const newAmount = ethers.utils.parseEther("200000");
            const newPeriod = 7200;
            
            await xio.updateRateLimit(newAmount, newPeriod);
            
            expect(await xio.rateLimitAmount()).to.equal(newAmount);
            expect(await xio.rateLimitPeriod()).to.equal(newPeriod);
        });

        it("Should pause and unpause transfers", async function () {
            await xio.pause();
            
            await expect(
                xio.transfer(addr1.address, 1000)
            ).to.be.revertedWith("Pausable: paused");
            
            await xio.unpause();
            await xio.transfer(addr1.address, 1000);
            
            expect(await xio.balanceOf(addr1.address)).to.be.gt(0);
        });
    });
});