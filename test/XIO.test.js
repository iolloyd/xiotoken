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
    
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("100000");
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
    });

    describe("Deployment", function () {
        it("Should set the right token details", async function () {
            expect(await xio.name()).to.equal("XIO Token");
            expect(await xio.symbol()).to.equal("XIO");
            expect(await xio.decimals()).to.equal(18);
        });

        it("Should assign the total supply to owner", async function () {
            const totalSupply = await xio.TOTAL_SUPPLY();
            expect(await xio.balanceOf(owner.address)).to.equal(totalSupply);
        });

        it("Should set the correct roles", async function () {
            expect(await xio.hasRole(await xio.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await xio.hasRole(await xio.PAUSER_ROLE(), owner.address)).to.be.true;
            expect(await xio.hasRole(await xio.MINTER_ROLE(), owner.address)).to.be.true;
            expect(await xio.hasRole(await xio.BURNER_ROLE(), owner.address)).to.be.true;
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
            await xio.transfer(addr1.address, ethers.utils.parseEther("1000000"));
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
            const amount = RATE_LIMIT_AMOUNT;
            await xio.connect(addr1).transfer(addr2.address, amount);
            await time.increase(RATE_LIMIT_PERIOD);
            await xio.connect(addr1).transfer(addr2.address, amount);
            expect(await xio.balanceOf(addr2.address)).to.equal(amount.mul(2));
        });

        it("Should exempt addresses from rate limiting", async function () {
            await xio.updateRateLimitExemption(addr1.address, true);
            const amount = RATE_LIMIT_AMOUNT.mul(2);
            await xio.connect(addr1).transfer(addr2.address, amount);
            expect(await xio.balanceOf(addr2.address)).to.equal(amount);
        });

        it("Should provide accurate rate limit status", async function () {
            const amount = RATE_LIMIT_AMOUNT.div(2);
            await xio.connect(addr1).transfer(addr2.address, amount);
            
            const status = await xio.getRateLimitStatus(addr1.address);
            expect(status.currentPeriodTransfers).to.equal(amount);
            expect(status.remainingInPeriod).to.equal(RATE_LIMIT_AMOUNT.sub(amount));
        });
    });

    describe("Burn Mechanics", function () {
        it("Should enforce quarterly burn interval", async function () {
            const burnAmount = ethers.utils.parseEther("1000");
            await expect(
                xio.executeQuarterlyBurn(burnAmount)
            ).to.be.revertedWith("XIO: Too early for burn");
            
            await time.increase(QUARTERLY_BURN_INTERVAL);
            await xio.executeQuarterlyBurn(burnAmount);
            
            const burnStats = await xio.getBurnStats();
            expect(burnStats.totalBurnt).to.equal(burnAmount);
        });

        it("Should enforce maximum burn limit", async function () {
            await time.increase(QUARTERLY_BURN_INTERVAL);
            const maxBurnSupply = await xio.MAX_BURN_SUPPLY();
            
            await expect(
                xio.executeQuarterlyBurn(maxBurnSupply.add(1))
            ).to.be.revertedWith("XIO: Exceeds burn limit");
        });

        it("Should track burn statistics correctly", async function () {
            await time.increase(QUARTERLY_BURN_INTERVAL);
            const burnAmount = ethers.utils.parseEther("1000");
            await xio.executeQuarterlyBurn(burnAmount);
            
            const burnStats = await xio.getBurnStats();
            expect(burnStats.totalBurnt).to.equal(burnAmount);
            expect(burnStats.remainingToBurn).to.equal((await xio.MAX_BURN_SUPPLY()).sub(burnAmount));
            expect(burnStats.nextBurnAllowed).to.equal(
                (await xio.lastQuarterlyBurn()).add(QUARTERLY_BURN_INTERVAL)
            );
        });

        it("Should emit correct burn events", async function () {
            await time.increase(QUARTERLY_BURN_INTERVAL);
            const burnAmount = ethers.utils.parseEther("1000");
            
            await expect(xio.executeQuarterlyBurn(burnAmount))
                .to.emit(xio, "TokensBurned")
                .withArgs(burnAmount, burnAmount, await time.latest())
                .and.to.emit(xio, "QuarterlyBurnExecuted");
        });
    });

    describe("Emergency Functions", function () {
        it("Should activate emergency mode", async function () {
            await xio.initiateEmergencyMode();
            expect(await xio.emergencyMode()).to.be.true;
            expect(await xio.emergencyActionTimestamp())
                .to.equal((await time.latest()).add(24 * 3600));
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
            expect(await xio.balanceOf(addr1.address)).to.equal(1000);
        });

        it("Should enforce role-based access control", async function () {
            await expect(
                xio.connect(addr1).pause()
            ).to.be.reverted;
            
            await expect(
                xio.connect(addr1).updateRateLimit(1000, 1000)
            ).to.be.reverted;
            
            await expect(
                xio.connect(addr1).executeQuarterlyBurn(1000)
            ).to.be.reverted;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero transfers correctly", async function () {
            await expect(
                xio.transfer(addr1.address, 0)
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("Should handle rate limit period transitions", async function () {
            await xio.connect(addr1).transfer(addr2.address, RATE_LIMIT_AMOUNT);
            await time.increase(RATE_LIMIT_PERIOD - 1);
            
            // Should still be limited
            await expect(
                xio.connect(addr1).transfer(addr2.address, 1)
            ).to.be.revertedWith("XIO: Rate limit exceeded");
            
            await time.increase(2); // Cross the period boundary
            await xio.connect(addr1).transfer(addr2.address, RATE_LIMIT_AMOUNT);
        });

        it("Should handle multiple burns within periods correctly", async function () {
            await time.increase(QUARTERLY_BURN_INTERVAL);
            await xio.executeQuarterlyBurn(ethers.utils.parseEther("1000"));
            
            await expect(
                xio.executeQuarterlyBurn(ethers.utils.parseEther("1000"))
            ).to.be.revertedWith("XIO: Too early for burn");
            
            await time.increase(QUARTERLY_BURN_INTERVAL);
            await xio.executeQuarterlyBurn(ethers.utils.parseEther("1000"));
        });
    });
});
