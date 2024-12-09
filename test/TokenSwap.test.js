const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenSwap", function () {
    let XGEN;
    let XIO;
    let TokenSwap;
    let xgen;
    let xio;
    let tokenSwap;
    let owner;
    let addr1;
    let addr2;
    let emergencyRecovery;
    
    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion tokens
    const SWAP_AMOUNT = ethers.utils.parseEther("1000"); // 1000 tokens for testing
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("100000"); // 100k tokens
    const RATE_LIMIT_PERIOD = 3600; // 1 hour

    beforeEach(async function () {
        [owner, addr1, addr2, emergencyRecovery] = await ethers.getSigners();
        
        // Deploy XGEN token
        XGEN = await ethers.getContractFactory("XGEN");
        xgen = await XGEN.deploy(
            "XGEN Token",   // name
            "XGEN",        // symbol
            INITIAL_SUPPLY,
            INITIAL_SUPPLY.div(2), // seedRoundAllocation
            ethers.utils.parseEther("0.1"), // tokenPrice
            RATE_LIMIT_AMOUNT,
            RATE_LIMIT_PERIOD
        );
        await xgen.deployed();
        
        // Deploy XIO token
        XIO = await ethers.getContractFactory("XIO");
        xio = await XIO.deploy(
            RATE_LIMIT_AMOUNT,
            RATE_LIMIT_PERIOD,
            emergencyRecovery.address
        );
        await xio.deployed();
        
        // Get the current timestamp
        const currentTime = await time.latest();
        const swapStartTime = currentTime + 3600; // Start in 1 hour
        const swapDuration = 86400; // 24 hours
        
        // Deploy TokenSwap
        TokenSwap = await ethers.getContractFactory("TokenSwap");
        tokenSwap = await TokenSwap.deploy(
            xgen.address,        // XGEN token address
            xio.address,         // XIO token address
            swapStartTime,       // Swap start time
            swapDuration,        // Swap duration
            RATE_LIMIT_AMOUNT,   // Rate limit amount
            RATE_LIMIT_PERIOD,   // Rate limit period
            emergencyRecovery.address // Emergency recovery address
        );
        await tokenSwap.deployed();
        
        // Setup XGEN whitelist
        await xgen.updateWhitelist(owner.address, true);
        await xgen.updateWhitelist(addr1.address, true);
        await xgen.updateWhitelist(addr2.address, true);
        await xgen.updateWhitelist(tokenSwap.address, true);
        
        // Setup XIO exemptions
        await xio.updateRateLimitExemption(owner.address, true);
        await xio.updateRateLimitExemption(tokenSwap.address, true);
        
        // Setup for testing
        // 1. Transfer XGEN tokens to addr1 for testing
        await xgen.transfer(addr1.address, SWAP_AMOUNT.mul(2));
        
        // 2. Transfer XIO tokens to swap contract
        await xio.transfer(tokenSwap.address, SWAP_AMOUNT.mul(2));
        
        // 3. Approve token swap contract to spend tokens
        await xgen.connect(addr1).approve(tokenSwap.address, SWAP_AMOUNT.mul(2));
        
        // 4. Move time forward to start of swap period
        await time.increaseTo(swapStartTime);
    });

    describe("Swap Functionality", function () {
        it("Should swap tokens at 1:1 ratio", async function () {
            // Initial balances
            const initialXGENBalance = await xgen.balanceOf(addr1.address);
            const initialXIOBalance = await xio.balanceOf(addr1.address);
            
            // Execute swap
            await tokenSwap.connect(addr1).swap(SWAP_AMOUNT);
            
            // Check final balances
            expect(await xgen.balanceOf(addr1.address)).to.equal(
                initialXGENBalance.sub(SWAP_AMOUNT)
            );
            expect(await xio.balanceOf(addr1.address)).to.equal(
                initialXIOBalance.add(SWAP_AMOUNT)
            );
        });

        // ... rest of the tests remain unchanged ...
    });
});