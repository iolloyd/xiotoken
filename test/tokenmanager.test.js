const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XIO Token Manager", function () {
    let XIOToken;
    let XIOTokenManager;
    let xioToken;
    let tokenManager;
    let owner;
    let operator;
    let treasury;
    let recipient;
    let addrs;

    beforeEach(async function () {
        // Get signers
        [owner, operator, treasury, recipient, ...addrs] = await ethers.getSigners();

        // Deploy XIO token
        XIOToken = await ethers.getContractFactory("XIO");
        xioToken = await XIOToken.deploy(
            ethers.utils.parseEther("1000"), // rate limit amount
            86400, // rate limit period (1 day)
            owner.address // emergency recovery address
        );
        await xioToken.deployed();

        // Deploy Token Manager
        XIOTokenManager = await ethers.getContractFactory("XIOTokenManager");
        tokenManager = await XIOTokenManager.deploy(xioToken.address);
        await tokenManager.deployed();

        // Setup roles
        const OPERATOR_ROLE = await tokenManager.OPERATOR_ROLE();
        const TREASURY_ROLE = await tokenManager.TREASURY_ROLE();
        
        await tokenManager.grantRole(OPERATOR_ROLE, operator.address);
        await tokenManager.grantRole(TREASURY_ROLE, treasury.address);

        // Transfer tokens to token manager
        await xioToken.transfer(tokenManager.address, ethers.utils.parseEther("1000000"));
    });

    describe("Setup", function () {
        it("Should set correct initial parameters", async function () {
            expect(await tokenManager.xioToken()).to.equal(xioToken.address);
        });

        it("Should assign correct roles", async function () {
            const OPERATOR_ROLE = await tokenManager.OPERATOR_ROLE();
            const TREASURY_ROLE = await tokenManager.TREASURY_ROLE();
            
            expect(await tokenManager.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
            expect(await tokenManager.hasRole(TREASURY_ROLE, treasury.address)).to.be.true;
        });
    });

    describe("Transfer Management", function () {
        it("Should request transfer correctly", async function () {
            const amount = ethers.utils.parseEther("1000");
            await tokenManager.updateOperatorLimit(operator.address, amount);

            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                amount,
                "Test transfer"
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find(e => e.event === "TransferRequested");
            expect(event).to.not.be.undefined;
            expect(event.args.recipient).to.equal(recipient.address);
            expect(event.args.amount).to.equal(amount);
        });

        it("Should execute transfer after delay", async function () {
            const amount = ethers.utils.parseEther("1000");
            await tokenManager.updateOperatorLimit(operator.address, amount);

            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                amount,
                "Test transfer"
            );
            const receipt = await tx.wait();
            const requestId = receipt.events[0].args.requestId;

            // Move time forward
            await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
            await ethers.provider.send("evm_mine");

            // Execute transfer
            await tokenManager.connect(treasury).executeTransfer(requestId);

            // Verify transfer
            expect(await xioToken.balanceOf(recipient.address)).to.equal(amount);
        });

        it("Should respect operator limits", async function () {
            const limit = ethers.utils.parseEther("1000");
            const overLimit = ethers.utils.parseEther("1001");
            
            await tokenManager.updateOperatorLimit(operator.address, limit);

            await expect(
                tokenManager.connect(operator).requestTransfer(
                    recipient.address,
                    overLimit,
                    "Over limit transfer"
                )
            ).to.be.revertedWith("Exceeds limit");
        });
    });

    describe("Operator Management", function () {
        it("Should update operator limits", async function () {
            const limit = ethers.utils.parseEther("5000");
            await tokenManager.updateOperatorLimit(operator.address, limit);
            expect(await tokenManager.operatorLimits(operator.address)).to.equal(limit);
        });

        it("Should track daily operations", async function () {
            const amount = ethers.utils.parseEther("500");
            await tokenManager.updateOperatorLimit(operator.address, amount.mul(2));

            // First transfer
            await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                amount,
                "First transfer"
            );

            // Second transfer
            await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                amount,
                "Second transfer"
            );

            // Third transfer should fail (daily limit)
            await expect(
                tokenManager.connect(operator).requestTransfer(
                    recipient.address,
                    amount,
                    "Third transfer"
                )
            ).to.be.revertedWith("Daily limit exceeded");
        });
    });

    describe("Emergency Controls", function () {
        it("Should pause operations", async function () {
            await tokenManager.pause();
            
            const amount = ethers.utils.parseEther("100");
            await tokenManager.updateOperatorLimit(operator.address, amount);

            await expect(
                tokenManager.connect(operator).requestTransfer(
                    recipient.address,
                    amount,
                    "Paused transfer"
                )
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should resume operations after unpause", async function () {
            await tokenManager.pause();
            await tokenManager.unpause();
            
            const amount = ethers.utils.parseEther("100");
            await tokenManager.updateOperatorLimit(operator.address, amount);

            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                amount,
                "Resumed transfer"
            );

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });
    });
});
