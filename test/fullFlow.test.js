const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("XIO Token Full Flow", function () {
    let XIO;
    let XIOGovernance;
    let xioToken;
    let governance;
    let owner;
    let addr1;
    let addr2;
    let emergencyRecovery;
    
    // Constants for both contracts
    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion tokens
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("100000"); // 100k tokens
    const RATE_LIMIT_PERIOD = 3600; // 1 hour
    const QUARTERLY_BURN_INTERVAL = 90 * 24 * 3600; // 90 days
    const QUORUM_THRESHOLD = ethers.utils.parseEther("100000"); // 100k tokens
    const PROPOSAL_THRESHOLD = ethers.utils.parseEther("10000"); // 10k tokens
    
    before(async function () {
        [owner, addr1, addr2, emergencyRecovery] = await ethers.getSigners();
        
        // Deploy XIO Token
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

        // Setup roles and permissions
        await xioToken.grantRole(await xioToken.GOVERNANCE_ROLE(), governance.address);
        await xioToken.updateRateLimitExemption(governance.address, true);
        await xioToken.updateRateLimitExemption(owner.address, true);
        await xioToken.updateRateLimitExemption(addr1.address, true);

        // Initial token distribution
        await xioToken.transfer(addr1.address, ethers.utils.parseEther("200000")); // 200k tokens
        await xioToken.transfer(governance.address, ethers.utils.parseEther("100000")); // 100k tokens
    });

    it("Should demonstrate complete token lifecycle", async function () {
        // 1. Check initial setup
        expect(await xioToken.totalSupply()).to.equal(INITIAL_SUPPLY);
        expect(await xioToken.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("200000"));

        // 2. Execute a transfer with rate limiting
        await xioToken.updateRateLimitExemption(addr1.address, false);
        await xioToken.connect(addr1).transfer(addr2.address, RATE_LIMIT_AMOUNT);
        expect(await xioToken.balanceOf(addr2.address)).to.equal(RATE_LIMIT_AMOUNT);

        // 3. Execute a burn
        const burnAmount = ethers.utils.parseEther("1000");
        await xioToken.executeQuarterlyBurn(burnAmount);
        const burnStats = await xioToken.getBurnStats();
        expect(burnStats.totalBurnt).to.equal(burnAmount);

        // 4. Create and execute a governance proposal
        const proposalId = ethers.utils.id("Test Full Flow Proposal");
        const signatures = [
            await owner.signMessage(ethers.utils.arrayify(proposalId)),
            await addr1.signMessage(ethers.utils.arrayify(proposalId)),
            await addr2.signMessage(ethers.utils.arrayify(proposalId))
        ];

        // Schedule proposal
        await governance.scheduleProposal(proposalId, signatures);

        // Move time forward
        await time.increase(172800); // 2 days

        // Execute proposal (transfer tokens)
        const transferAmount = ethers.utils.parseEther("1000");
        const proposalCallData = xioToken.interface.encodeFunctionData("transfer", [
            addr2.address,
            transferAmount
        ]);

        await governance.executeProposal(
            proposalId,
            [xioToken.address],
            [0],
            [proposalCallData]
        );

        expect(await governance.proposalExecuted(proposalId)).to.be.true;

        // 5. Test emergency action
        const emergencyProposalId = ethers.utils.id("Emergency Action");
        const emergencyAmount = ethers.utils.parseEther("5000");
        const emergencyCallData = xioToken.interface.encodeFunctionData("transfer", [
            emergencyRecovery.address,
            emergencyAmount
        ]);

        await governance.executeEmergencyAction(
            emergencyProposalId,
            [xioToken.address],
            [0],
            [emergencyCallData],
            "Emergency test action"
        );

        expect(await governance.proposalExecuted(emergencyProposalId)).to.be.true;
        expect(await xioToken.balanceOf(emergencyRecovery.address)).to.equal(emergencyAmount);
    });
});