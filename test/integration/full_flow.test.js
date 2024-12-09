// test/integration/full_flow.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("XIO Token Full Flow", function() {
    let XIO, XIOGovernance;
    let xioToken, governance;
    let owner, addr1, addr2, emergencyRecovery;
    
    // Constants
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("100000"); // 100k tokens
    const RATE_LIMIT_PERIOD = 3600; // 1 hour
    const QUORUM_THRESHOLD = ethers.utils.parseEther("100000"); // 100k tokens
    const PROPOSAL_THRESHOLD = ethers.utils.parseEther("10000"); // 10k tokens

    before(async function() {
        [owner, addr1, addr2, emergencyRecovery] = await ethers.getSigners();

        // Deploy XIO token with correct parameters
        XIO = await ethers.getContractFactory("XIO");
        xioToken = await XIO.deploy(
            RATE_LIMIT_AMOUNT,
            RATE_LIMIT_PERIOD,
            emergencyRecovery.address
        );
        await xioToken.deployed();

        // Deploy Governance
        XIOGovernance = await ethers.getContractFactory("XIOGovernance");
        governance = await XIOGovernance.deploy(
            xioToken.address,
            QUORUM_THRESHOLD,
            PROPOSAL_THRESHOLD
        );
        await governance.deployed();

        // Setup initial configuration
        await xioToken.grantRole(await xioToken.GOVERNANCE_ROLE(), governance.address);
        await xioToken.updateRateLimitExemption(governance.address, true);
        await xioToken.updateRateLimitExemption(owner.address, true);
        await xioToken.updateRateLimitExemption(addr1.address, true);

        // Fund accounts for testing
        await xioToken.transfer(addr1.address, ethers.utils.parseEther("200000")); // 200k tokens
        await xioToken.transfer(governance.address, ethers.utils.parseEther("100000")); // 100k tokens
    });

    describe("1. Token Setup and Basic Operations", function() {
        it("Should have correct initial configuration", async function() {
            expect(await xioToken.rateLimitAmount()).to.equal(RATE_LIMIT_AMOUNT);
            expect(await xioToken.rateLimitPeriod()).to.equal(RATE_LIMIT_PERIOD);
            expect(await xioToken.emergencyRecoveryAddress()).to.equal(emergencyRecovery.address);
        });

        it("Should handle rate-limited transfers correctly", async function() {
            await xioToken.updateRateLimitExemption(addr1.address, false);
            
            // Should allow transfer within limit
            await xioToken.connect(addr1).transfer(addr2.address, RATE_LIMIT_AMOUNT);
            
            // Should reject transfer exceeding limit
            await expect(
                xioToken.connect(addr1).transfer(addr2.address, RATE_LIMIT_AMOUNT.add(1))
            ).to.be.revertedWith("XIO: Rate limit exceeded");
        });
    });

    describe("2. Burn Mechanics", function() {
        it("Should execute burns correctly", async function() {
            const burnAmount = ethers.utils.parseEther("1000");
            
            // Execute first burn
            await xioToken.executeQuarterlyBurn(burnAmount);
            
            // Verify burn stats
            const burnStats = await xioToken.getBurnStats();
            expect(burnStats.totalBurnt).to.equal(burnAmount);
            
            // Try immediate second burn (should fail)
            await expect(
                xioToken.executeQuarterlyBurn(burnAmount)
            ).to.be.revertedWith("XIO: Too early for burn");
        });
    });

    describe("3. Governance Integration", function() {
        it("Should execute governance proposals", async function() {
            const proposalId = ethers.utils.id("Test Proposal");
            const signatures = [
                await owner.signMessage(ethers.utils.arrayify(proposalId)),
                await addr1.signMessage(ethers.utils.arrayify(proposalId)),
                await addr2.signMessage(ethers.utils.arrayify(proposalId))
            ];

            // Schedule proposal
            await governance.scheduleProposal(proposalId, signatures);
            
            // Move time forward
            await time.increase(172800); // 2 days
            
            // Execute proposal
            const transferAmount = ethers.utils.parseEther("1000");
            const callData = xioToken.interface.encodeFunctionData("transfer", [
                addr2.address,
                transferAmount
            ]);

            await governance.executeProposal(
                proposalId,
                [xioToken.address],
                [0],
                [callData]
            );

            expect(await governance.proposalExecuted(proposalId)).to.be.true;
        });

        it("Should handle emergency actions", async function() {
            const proposalId = ethers.utils.id("Emergency");
            const transferAmount = ethers.utils.parseEther("1000");
            const callData = xioToken.interface.encodeFunctionData("transfer", [
                emergencyRecovery.address,
                transferAmount
            ]);

            const balanceBefore = await xioToken.balanceOf(emergencyRecovery.address);

            await governance.executeEmergencyAction(
                proposalId,
                [xioToken.address],
                [0],
                [callData],
                "Emergency test"
            );

            expect(await xioToken.balanceOf(emergencyRecovery.address))
                .to.equal(balanceBefore.add(transferAmount));
        });
    });
});