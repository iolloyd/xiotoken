const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("XIO Token Manager", function () {
    let XIO;
    let XIOTokenManager;
    let xioToken;
    let tokenManager;
    let owner;
    let operator;
    let treasury;
    let recipient;
    let addr1;
    
    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion tokens
    const OPERATOR_LIMIT = ethers.utils.parseEther("100000"); // 100k tokens
    const TRANSFER_AMOUNT = ethers.utils.parseEther("1000"); // 1k tokens for testing
    const RATE_LIMIT_AMOUNT = ethers.utils.parseEther("100000"); // 100k tokens
    const RATE_LIMIT_PERIOD = 3600; // 1 hour

    beforeEach(async function () {
        [owner, operator, treasury, recipient, addr1] = await ethers.getSigners();
        
        // Deploy XIO token
        XIO = await ethers.getContractFactory("XIO");
        xioToken = await XIO.deploy(
            RATE_LIMIT_AMOUNT,
            RATE_LIMIT_PERIOD,
            treasury.address
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
        
        // Transfer tokens to token manager and set up exemptions
        await xioToken.transfer(tokenManager.address, INITIAL_SUPPLY.div(10));
        await xioToken.updateRateLimitExemption(tokenManager.address, true);
        await tokenManager.updateOperatorLimit(operator.address, OPERATOR_LIMIT);
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
            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                TRANSFER_AMOUNT,
                "Test transfer"
            );

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "TransferRequested");
            
            expect(event).to.not.be.undefined;
            expect(event.args.recipient).to.equal(recipient.address);
            expect(event.args.amount).to.equal(TRANSFER_AMOUNT);
        });

        it("Should execute transfer after delay", async function () {
            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                TRANSFER_AMOUNT,
                "Test transfer"
            );
            const receipt = await tx.wait();
            const requestId = receipt.events[0].args.requestId;

            // Move time forward
            await time.increase(86400); // 1 day

            await tokenManager.connect(treasury).executeTransfer(requestId);
            expect(await xioToken.balanceOf(recipient.address)).to.equal(TRANSFER_AMOUNT);
        });

        it("Should prevent early execution", async function () {
            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                TRANSFER_AMOUNT,
                "Test transfer"
            );
            const receipt = await tx.wait();
            const requestId = receipt.events[0].args.requestId;

            await expect(
                tokenManager.connect(treasury).executeTransfer(requestId)
            ).to.be.revertedWith("Too early");
        });

        it("Should prevent double execution", async function () {
            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                TRANSFER_AMOUNT,
                "Test transfer"
            );
            const receipt = await tx.wait();
            const requestId = receipt.events[0].args.requestId;

            await time.increase(86400);
            await tokenManager.connect(treasury).executeTransfer(requestId);

            await expect(
                tokenManager.connect(treasury).executeTransfer(requestId)
            ).to.be.revertedWith("Already executed");
        });
    });

    describe("Operator Management", function () {
        it("Should enforce operator limits", async function () {
            await expect(
                tokenManager.connect(operator).requestTransfer(
                    recipient.address,
                    OPERATOR_LIMIT.add(1),
                    "Over limit"
                )
            ).to.be.revertedWith("Exceeds limit");
        });

        it("Should track daily operations", async function () {
            // First transfer
            await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                OPERATOR_LIMIT.div(2),
                "First transfer"
            );

            // Second transfer reaching the limit
            await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                OPERATOR_LIMIT.div(2),
                "Second transfer"
            );

            // Third transfer exceeding daily limit
            await expect(
                tokenManager.connect(operator).requestTransfer(
                    recipient.address,
                    1,
                    "Third transfer"
                )
            ).to.be.revertedWith("Daily limit exceeded");

            // Move to next day
            await time.increase(86400);

            // Should allow transfer again
            await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                OPERATOR_LIMIT.div(2),
                "Next day transfer"
            );
        });

        it("Should update operator limits", async function () {
            const newLimit = OPERATOR_LIMIT.mul(2);
            await tokenManager.updateOperatorLimit(operator.address, newLimit);
            
            // Should allow transfer with new limit
            await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                OPERATOR_LIMIT.add(1),
                "Increased limit transfer"
            );
        });
    });

    describe("Emergency Controls", function () {
        it("Should handle emergency token recovery", async function () {
            const recoveryAmount = ethers.utils.parseEther("1000");
            const initialBalance = await xioToken.balanceOf(owner.address);
            
            await tokenManager.emergencyRecover(
                xioToken.address,
                recoveryAmount,
                "Security incident recovery"
            );
            
            const finalBalance = await xioToken.balanceOf(owner.address);
            expect(finalBalance.sub(initialBalance)).to.equal(recoveryAmount);
        });

        it("Should pause and unpause operations", async function () {
            await tokenManager.pause();
            
            await expect(
                tokenManager.connect(operator).requestTransfer(
                    recipient.address,
                    TRANSFER_AMOUNT,
                    "Paused transfer"
                )
            ).to.be.revertedWith("Pausable: paused");
            
            await tokenManager.unpause();
            
            await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                TRANSFER_AMOUNT,
                "Resumed transfer"
            );
        });
    });

    describe("Transfer Request Details", function () {
        it("Should return correct transfer request details", async function () {
            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                TRANSFER_AMOUNT,
                "Test transfer"
            );
            const receipt = await tx.wait();
            const requestId = receipt.events[0].args.requestId;

            const [reqRecipient, amount, executionTime, executed, purpose] = 
                await tokenManager.getTransferRequest(requestId);
            
            expect(reqRecipient).to.equal(recipient.address);
            expect(amount).to.equal(TRANSFER_AMOUNT);
            expect(executed).to.be.false;
            expect(purpose).to.equal("Test transfer");
            expect(executionTime).to.be.gt(await time.latest());
        });
    });

    describe("Access Control", function () {
        it("Should restrict functions to appropriate roles", async function () {
            // Only operator can request transfers
            await expect(
                tokenManager.connect(addr1).requestTransfer(
                    recipient.address,
                    TRANSFER_AMOUNT,
                    "Unauthorized transfer"
                )
            ).to.be.reverted;

            // Only treasury can execute transfers
            const tx = await tokenManager.connect(operator).requestTransfer(
                recipient.address,
                TRANSFER_AMOUNT,
                "Test transfer"
            );
            const receipt = await tx.wait();
            const requestId = receipt.events[0].args.requestId;

            await time.increase(86400);
            await expect(
                tokenManager.connect(addr1).executeTransfer(requestId)
            ).to.be.reverted;

            // Only admin can update operator limits
            await expect(
                tokenManager.connect(addr1).updateOperatorLimit(operator.address, 1)
            ).to.be.reverted;

            // Only admin can pause/unpause
            await expect(
                tokenManager.connect(addr1).pause()
            ).to.be.reverted;
        });
    });
});