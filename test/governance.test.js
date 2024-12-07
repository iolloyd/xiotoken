const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XIO Governance System", function () {
    let XIOToken;
    let XIOGovernance;
    let XIOTokenManager;
    let xioToken;
    let governance;
    let tokenManager;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy XIO token
        XIOToken = await ethers.getContractFactory("XIO");
        xioToken = await XIOToken.deploy(
            ethers.utils.parseEther("1000"), // rate limit amount
            86400, // rate limit period (1 day)
            owner.address // emergency recovery address
        );
        await xioToken.deployed();

        // Deploy Governance
        XIOGovernance = await ethers.getContractFactory("XIOGovernance");
        governance = await XIOGovernance.deploy(
            xioToken.address,
            ethers.utils.parseEther("100000"), // quorum threshold
            ethers.utils.parseEther("10000") // proposal threshold
        );
        await governance.deployed();

        // Deploy Token Manager
        XIOTokenManager = await ethers.getContractFactory("XIOTokenManager");
        tokenManager = await XIOTokenManager.deploy(xioToken.address);
        await tokenManager.deployed();

        // Setup roles
        const EXECUTOR_ROLE = await governance.EXECUTOR_ROLE();
        const PROPOSER_ROLE = await governance.PROPOSER_ROLE();
        const OPERATOR_ROLE = await tokenManager.OPERATOR_ROLE();
        
        await governance.grantRole(EXECUTOR_ROLE, tokenManager.address);
        await tokenManager.grantRole(OPERATOR_ROLE, governance.address);
    });

    describe("Governance Setup", function () {
        it("Should set correct initial parameters", async function () {
            expect(await governance.xioToken()).to.equal(xioToken.address);
            expect(await governance.quorumThreshold()).to.equal(ethers.utils.parseEther("100000"));
            expect(await governance.proposalThreshold()).to.equal(ethers.utils.parseEther("10000"));
        });

        it("Should grant correct roles", async function () {
            const EXECUTOR_ROLE = await governance.EXECUTOR_ROLE();
            const PROPOSER_ROLE = await governance.PROPOSER_ROLE();
            
            expect(await governance.hasRole(EXECUTOR_ROLE, tokenManager.address)).to.be.true;
            expect(await governance.hasRole(PROPOSER_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Proposal Management", function () {
        it("Should schedule a proposal correctly", async function () {
            const proposalId = ethers.utils.id("Test Proposal");
            const signatures = [
                ethers.utils.arrayify(ethers.utils.id("sig1")),
                ethers.utils.arrayify(ethers.utils.id("sig2")),
                ethers.utils.arrayify(ethers.utils.id("sig3"))
            ];

            await governance.scheduleProposal(proposalId, signatures);
            
            const deadline = await governance.proposalDeadlines(proposalId);
            expect(deadline).to.be.gt(0);
        });

        it("Should execute a proposal after delay", async function () {
            const proposalId = ethers.utils.id("Test Proposal");
            const signatures = [
                ethers.utils.arrayify(ethers.utils.id("sig1")),
                ethers.utils.arrayify(ethers.utils.id("sig2")),
                ethers.utils.arrayify(ethers.utils.id("sig3"))
            ];

            await governance.scheduleProposal(proposalId, signatures);
            
            // Move time forward
            await ethers.provider.send("evm_increaseTime", [172800]); // 2 days
            await ethers.provider.send("evm_mine");

            // Mock proposal execution
            const mockCalldata = ethers.utils.id("test").slice(0, 10);
            await governance.executeProposal(
                proposalId,
                [addr1.address],
                [0],
                [mockCalldata]
            );

            expect(await governance.proposalExecuted(proposalId)).to.be.true;
        });
    });

    describe("Parameter Updates", function () {
        it("Should update governance parameters", async function () {
            const newQuorum = ethers.utils.parseEther("200000");
            const newThreshold = ethers.utils.parseEther("20000");

            await governance.updateGovernanceParameters(newQuorum, newThreshold);

            expect(await governance.quorumThreshold()).to.equal(newQuorum);
            expect(await governance.proposalThreshold()).to.equal(newThreshold);
        });

        it("Should revert parameter updates from non-admin", async function () {
            const newQuorum = ethers.utils.parseEther("200000");
            const newThreshold = ethers.utils.parseEther("20000");

            await expect(
                governance.connect(addr1).updateGovernanceParameters(newQuorum, newThreshold)
            ).to.be.reverted;
        });
    });

    describe("Emergency Actions", function () {
        it("Should execute emergency action", async function () {
            const proposalId = ethers.utils.id("Emergency");
            const mockCalldata = ethers.utils.id("emergency").slice(0, 10);

            await governance.executeEmergencyAction(
                proposalId,
                [addr1.address],
                [0],
                [mockCalldata],
                "Critical security fix"
            );

            // Verify event emission
            const filter = governance.filters.EmergencyActionExecuted(proposalId);
            const events = await governance.queryFilter(filter);
            expect(events.length).to.equal(1);
            expect(events[0].args.reason).to.equal("Critical security fix");
        });
    });
});
