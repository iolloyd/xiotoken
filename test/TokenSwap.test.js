const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenSwap", function () {
    let TokenSwap;
    let XGEN;
    let XIO;
    let tokenSwap;
    let xgen;
    let xio;
    let owner;
    let addr1;
    let addr2;
    let emergencyRecovery;
    
    const SWAP_DELAY = 3600; // 1 hour
    const SWAP_DURATION = 86400; // 1 day
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("10000");
    const RATE_LIMIT_PERIOD = 3600; // 1 hour

    beforeEach(async function () {
        [owner, addr1, addr2, emergencyRecovery] = await ethers.getSigners();

        // Deploy XGEN token
        XGEN = await ethers.getContractFactory("XGEN");
        xgen = await XGEN.deploy(
            ethers.utils.parseEther("1000000"),
            ethers.utils.parseEther("100000"),
            ethers.utils.parseEther("0.1"),
            ethers.utils.parseEther("10000"),
            3600
        );
        await xgen.deployed();

        // Deploy XIO token (using XGEN contract for simplicity)
        XIO = await ethers.getContractFactory("XGEN");
        xio = await XIO.deploy(
            ethers.utils.parseEther("1000000"),
            ethers.utils.parseEther("100000"),
            ethers.utils.parseEther("0.1"),
            ethers.utils.parseEther("10000"),
            3600
        );
        await xio.deployed();

        // Deploy TokenSwap
        const startTime = (await time.latest()) + SWAP_DELAY;
        TokenSwap = await ethers.getContractFactory("TokenSwap");
        tokenSwap = await TokenSwap.deploy(
            xgen.address,
            xio.address,
            startTime,
            SWAP_DURATION,
            RATE_LIMIT_AMOUNT,
            RATE_LIMIT_PERIOD,
            emergencyRecovery.address
        );
        await tokenSwap.deployed();

        // Setup initial token states
        await xgen.mint(addr1.address, ethers.utils.parseEther("10000"));
        await xio.mint(tokenSwap.address, ethers.utils.parseEther("10000"));

        // Whitelist addresses
        await xgen.updateWhitelist(addr1.address, true);
        await xgen.updateWhitelist(addr2.address, true);
        await xgen.updateWhitelist(tokenSwap.address, true);
    });

    describe("Swap Functionality", function () {
        beforeEach(async function () {
            await time.increase(SWAP_DELAY);
            await xgen.connect(addr1).approve(tokenSwap.address, ethers.utils.parseEther("10000"));
        });

        it("Should swap tokens at 1:1 ratio", async function () {
            const swapAmount = ethers.utils.parseEther("100");
            await tokenSwap.connect(addr1).swap(swapAmount);

            expect(await xgen.balanceOf(tokenSwap.address)).to.equal(swapAmount);
            expect(await xio.balanceOf(addr1.address)).to.equal(swapAmount);
        });

        it("Should enforce rate limits", async function () {
            const swapAmount = RATE_LIMIT_AMOUNT.add(1);
            await expect(
                tokenSwap.connect(addr1).swap(swapAmount)
            ).to.be.revertedWith("TokenSwap: Rate limit exceeded");
        });

        it("Should reset rate limit after period", async function () {
            const swapAmount = RATE_LIMIT_AMOUNT;
            await tokenSwap.connect(addr1).swap(swapAmount);
            await time.increase(RATE_LIMIT_PERIOD);
            await tokenSwap.connect(addr1).swap(swapAmount);

            expect(await xio.balanceOf(addr1.address)).to.equal(swapAmount.mul(2));
        });

        it("Should support batch swaps", async function () {
            const amounts = [
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200"),
                ethers.utils.parseEther("300")
            ];
            await tokenSwap.connect(addr1).batchSwap(amounts);

            const totalAmount = amounts.reduce((a, b) => a.add(b));
            expect(await xio.balanceOf(addr1.address)).to.equal(totalAmount);
        });
    });

    describe("Emergency Functionality", function () {
        it("Should activate emergency mode", async function () {
            await tokenSwap.initiateEmergencyMode();
            expect(await tokenSwap.emergencyMode()).to.be.true;
        });

        it("Should respect emergency delay", async function () {
            await tokenSwap.initiateEmergencyMode();
            await expect(
                tokenSwap.connect(emergencyRecovery).emergencyWithdraw(xio.address)
            ).to.be.revertedWith("TokenSwap: Emergency delay not passed");

            await time.increase(24 * 3600); // 24 hours
            await tokenSwap.connect(emergencyRecovery).emergencyWithdraw(xio.address);
            expect(await xio.balanceOf(emergencyRecovery.address)).to.be.gt(0);
        });

        it("Should only allow emergency recovery address to withdraw", async function () {
            await tokenSwap.initiateEmergencyMode();
            await time.increase(24 * 3600);
            await expect(
                tokenSwap.connect(addr1).emergencyWithdraw(xio.address)
            ).to.be.revertedWith("TokenSwap: Not recovery address");
        });
    });

    describe("Administrative Functions", function () {
        it("Should update rate limit parameters", async function () {
            const newAmount = ethers.utils.parseEther("20000");
            const newPeriod = 7200;
            await tokenSwap.updateRateLimit(newAmount, newPeriod);

            expect(await tokenSwap.rateLimitAmount()).to.equal(newAmount);
            expect(await tokenSwap.rateLimitPeriod()).to.equal(newPeriod);
        });

        it("Should update emergency recovery address", async function () {
            await tokenSwap.updateEmergencyRecovery(addr2.address);
            expect(await tokenSwap.emergencyRecoveryAddress()).to.equal(addr2.address);
        });

        it("Should pause and unpause swaps", async function () {
            await tokenSwap.pause();
            await expect(
                tokenSwap.connect(addr1).swap(ethers.utils.parseEther("100"))
            ).to.be.revertedWith("Pausable: paused");

            await tokenSwap.unpause();
            await tokenSwap.connect(addr1).swap(ethers.utils.parseEther("100"));
        });
    });

    describe("Edge Cases", function () {
        it("Should fail if swap window not started", async function () {
            await time.decrease(SWAP_DELAY * 2);
            await expect(
                tokenSwap.connect(addr1).swap(ethers.utils.parseEther("100"))
            ).to.be.revertedWith("TokenSwap: Swap not started");
        });

        it("Should fail if swap window ended", async function () {
            await time.increase(SWAP_DELAY + SWAP_DURATION + 1);
            await expect(
                tokenSwap.connect(addr1).swap(ethers.utils.parseEther("100"))
            ).to.be.revertedWith("TokenSwap: Swap ended");
        });

        it("Should fail if insufficient XIO balance", async function () {
            const largeAmount = ethers.utils.parseEther("20000");
            await xgen.mint(addr1.address, largeAmount);
            await xgen.connect(addr1).approve(tokenSwap.address, largeAmount);

            await expect(
                tokenSwap.connect(addr1).swap(largeAmount)
            ).to.be.revertedWith("TokenSwap: Insufficient XIO balance");
        });

        it("Should fail for zero amount swaps", async function () {
            await expect(
                tokenSwap.connect(addr1).swap(0)
            ).to.be.revertedWith("TokenSwap: Amount must be positive");
        });

        it("Should fail for empty batch swaps", async function () {
            await expect(
                tokenSwap.connect(addr1).batchSwap([])
            ).to.be.revertedWith("TokenSwap: Empty amounts array");
        });
    });
});
