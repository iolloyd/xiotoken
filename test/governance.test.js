const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("XIO Governance System", function () {
    let XIO;
    let XIOGovernance;
    let xioToken;
    let governance;
    let owner;
    let addr1;
    let addr2;
    let emergencyRecovery;
    
    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion tokens
    const QUORUM_THRESHOLD = ethers.utils.parseEther("100000"); // 100k tokens
    const PROPOSAL_THRESHOLD = ethers.utils.parseEther("10000"); // 10k tokens
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("100000"); // 100k tokens
    const RATE_LIMIT_PERIOD = 3600; // 1 hour
    const TEST_AMOUNT = ethers.utils.parseEther("1"); // 1 token for testing

    beforeEach(async function () {
        [owner, addr1, addr2, emergencyRecovery] = await ethers.getSigners();
        
        // Deploy XIO token
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
        
        // Give governance contract the needed roles and exemptions
        const GOVERNANCE_ROLE = await xioToken.GOVERNANCE_ROLE();
        await xioToken.grantRole(GOVERNANCE_ROLE, governance.address);
        await xioToken.updateRateLimitExemption(governance.address, true);
        
        // Transfer tokens for testing
        await xioToken.transfer(addr1.address, PROPOSAL_THRESHOLD.mul(2));
        await xioToken.transfer(governance.address, ethers.utils.parseEther("10000")); // Fund governance
        await xioToken.updateRateLimitExemption(owner.address, true);
        await xioToken.updateRateLimitExemption(addr1.address, true);
    });

    describe("Proposal Management", function () {
        let proposalId;
        let callData;

        beforeEach(async function () {
            proposalId = ethers.utils.id("Test Proposal");
            const signatures = [
                await owner.signMessage(ethers.utils.arrayify(proposalId)),
                await addr1.signMessage(ethers.utils.arrayify(proposalId)),
                await addr2.signMessage(ethers.utils.arrayify(proposalId))
            ];

            // Prepare a simple transfer call
            callData = xioToken.interface.encodeFunctionData("transfer", [
                addr2.address,
                TEST_AMOUNT
            ]);

            await governance.scheduleProposal(proposalId, signatures);
        });

        it("Should execute a proposal after delay", async function () {
            const balanceBefore = await xioToken.balanceOf(addr2.address);
            
            // Move time forward past execution delay
            await time.increase(172800); // 2 days
            
            await governance.executeProposal(
                proposalId,
                [xioToken.address],
                [0],
                [callData]
            );

            expect(await governance.proposalExecuted(proposalId)).to.be.true;
            expect(await xioToken.balanceOf(addr2.address)).to.equal(balanceBefore.add(TEST_AMOUNT));
        });

        it("Should not allow execution before delay", async function () {
            await expect(
                governance.executeProposal(
                    proposalId,
                    [xioToken.address],
                    [0],
                    [callData]
                )
            ).to.be.revertedWith("Too early");
        });
    });

    describe("Emergency Actions", function () {
        let emergencyCallData;
        let proposalId;

        beforeEach(async function () {
            proposalId = ethers.utils.id("Emergency");
            emergencyCallData = xioToken.interface.encodeFunctionData("transfer", [
                emergencyRecovery.address,
                TEST_AMOUNT
            ]);
        });

        it("Should execute emergency action", async function () {
            const balanceBefore = await xioToken.balanceOf(emergencyRecovery.address);

            await governance.executeEmergencyAction(
                proposalId,
                [xioToken.address],
                [0],
                [emergencyCallData],
                "Critical security fix"
            );

            expect(await governance.proposalExecuted(proposalId)).to.be.true;
            expect(await xioToken.balanceOf(emergencyRecovery.address)).to.equal(
                balanceBefore.add(TEST_AMOUNT)
            );
        });

        it("Should restrict emergency actions to admin", async function () {
            await expect(
                governance.connect(addr1).executeEmergencyAction(
                    proposalId,
                    [xioToken.address],
                    [0],
                    [emergencyCallData],
                    "Critical security fix"
                )
            ).to.be.reverted;
        });
    });

    describe("Token Integration", function () {
        it("Should correctly check proposal eligibility", async function () {
            // Start with enough tokens to be eligible
            expect(await governance.canPropose(addr1.address)).to.be.true;

            // Transfer tokens away to make addr1 ineligible
            await xioToken.connect(addr1).transfer(
                addr2.address, 
                PROPOSAL_THRESHOLD.mul(2)
            );
            expect(await governance.canPropose(addr1.address)).to.be.false;
        });
    });
});