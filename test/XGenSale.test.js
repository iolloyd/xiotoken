const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XGenSale", function() {
    let owner, buyer, addr1;
    let xgenToken, xgenVesting, xgenSale;
    let tokenPrice;
    
    beforeEach(async function() {
        [owner, buyer, addr1] = await ethers.getSigners();
        
        // Set token price to a smaller value
        tokenPrice = ethers.utils.parseEther("0.000001"); // 0.000001 ETH per token (much smaller)
        
        // Set sale timing
        const latestBlock = await ethers.provider.getBlock('latest');
        const currentTime = latestBlock.timestamp;
        const startTime = currentTime + 3600; // start in 1 hour
        const endTime = startTime + 86400; // end in 24 hours after start
        
        // Deploy token
        const XGEN = await ethers.getContractFactory("XGEN");
        xgenToken = await XGEN.deploy(
            "XGEN Token",
            "XGEN",
            ethers.utils.parseEther("1000000000"),
            ethers.utils.parseEther("100000000"),
            tokenPrice,
            ethers.utils.parseEther("100000"),
            3600
        );
        await xgenToken.deployed();
        
        // Deploy vesting with no initial tokens
        const XGENVesting = await ethers.getContractFactory("XGENVesting", owner);
        xgenVesting = await XGENVesting.deploy(
            xgenToken.address,
            180 * 24 * 60 * 60, // 180 days cliff
            540 * 24 * 60 * 60  // 540 days vesting
        );
        await xgenVesting.deployed();
        
        // Deploy sale
        const XGENSale = await ethers.getContractFactory("XGENSale", owner);
        xgenSale = await XGENSale.deploy(
            xgenToken.address,
            xgenVesting.address,
            startTime,
            endTime,
            tokenPrice
        );
        await xgenSale.deployed();

        // Update rate limits to allow large transfers
        await xgenToken.updateRateLimit(
            ethers.utils.parseEther("1000000000"), // 1B tokens per period
            3600 // 1 hour period
        );

        // Whitelist all addresses
        await xgenToken.grantRole(await xgenToken.CONFIGURATOR_ROLE(), owner.address);
        await xgenToken.updateWhitelist(owner.address, true);
        await xgenToken.updateWhitelist(buyer.address, true);
        await xgenToken.updateWhitelist(xgenSale.address, true);
        await xgenToken.updateWhitelist(xgenVesting.address, true);
        
        // Debug whitelist status
        console.log("\nWhitelist status:");
        console.log("Owner whitelisted:", await xgenToken.whitelist(owner.address));
        console.log("Buyer whitelisted:", await xgenToken.whitelist(buyer.address));
        console.log("Sale contract whitelisted:", await xgenToken.whitelist(xgenSale.address));
        console.log("Vesting contract whitelisted:", await xgenToken.whitelist(xgenVesting.address));

        // Grant roles to contracts
        await xgenToken.grantRole(await xgenToken.CONFIGURATOR_ROLE(), xgenVesting.address);
        await xgenToken.grantRole(await xgenToken.MINTER_ROLE(), xgenVesting.address);
        await xgenToken.grantRole(await xgenToken.CONFIGURATOR_ROLE(), xgenSale.address);
        
        // Debug roles
        console.log("\nRole status:");
        console.log("Vesting has CONFIGURATOR_ROLE:", await xgenToken.hasRole(await xgenToken.CONFIGURATOR_ROLE(), xgenVesting.address));
        console.log("Vesting has MINTER_ROLE:", await xgenToken.hasRole(await xgenToken.MINTER_ROLE(), xgenVesting.address));
        console.log("Sale has CONFIGURATOR_ROLE:", await xgenToken.hasRole(await xgenToken.CONFIGURATOR_ROLE(), xgenSale.address));
        
        // Grant roles to sale contract in vesting contract
        const MANAGER_ROLE = await xgenVesting.MANAGER_ROLE();
        await xgenVesting.connect(owner).grantRole(MANAGER_ROLE, xgenSale.address);
        
        // Debug vesting contract permissions
        console.log("\nVesting contract permissions:");
        console.log("Sale contract has MANAGER_ROLE:", await xgenVesting.hasRole(MANAGER_ROLE, xgenSale.address));
        
        // Transfer tokens to sale contract
        const saleAmount = ethers.utils.parseEther("10000000"); // 10M tokens for sale
        await xgenToken.transfer(xgenSale.address, saleAmount);
        
        // Approve vesting contract to spend tokens from sale contract
        await xgenSale.connect(owner).approveVestingTransfer(saleAmount);
        
        // Debug token balances and approvals
        console.log("\nToken balances and approvals:");
        console.log("Owner token balance:", ethers.utils.formatEther(await xgenToken.balanceOf(owner.address)));
        console.log("Sale contract token balance:", ethers.utils.formatEther(await xgenToken.balanceOf(xgenSale.address)));
        console.log("Sale contract approval to vesting:", ethers.utils.formatEther(await xgenToken.allowance(xgenSale.address, xgenVesting.address)));

        // Approve KYC for buyer
        await xgenSale.updateKYCStatus(buyer.address, true);
        
        // Fast forward time to start of sale
        await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);
        await ethers.provider.send("evm_mine");
    });
    
    it("Should fail if purchase amount is not multiple of token price", async function() {
        // Get the actual minimum purchase requirement from contract
        const minPurchaseTokens = await xgenSale.MIN_PURCHASE_TOKENS();
        const actualTokenPrice = await xgenSale.tokenPrice();
        
        // Calculate a valid base amount first
        const baseAmount = minPurchaseTokens.mul(actualTokenPrice).div(ethers.utils.parseEther("1"));
        
        // Add half a token's worth to make it invalid
        const invalidAmount = baseAmount.add(actualTokenPrice.div(2));
        
        await expect(
            xgenSale.connect(buyer).purchaseTokens({ value: invalidAmount })
        ).to.be.revertedWith("Amount must be multiple of token price");
    });

    it("Should successfully transfer tokens to vesting contract", async function() {
        // Get contract values
        const minPurchaseTokens = await xgenSale.MIN_PURCHASE_TOKENS();
        const actualTokenPrice = await xgenSale.tokenPrice();
        
        // Calculate purchase amount to match contract's calculation
        const purchaseAmount = minPurchaseTokens.mul(actualTokenPrice).div(ethers.utils.parseEther("1"));
        
        // Add a small amount to ensure we're above minimum
        const safeAmount = purchaseAmount.mul(2);
        
        console.log("\nDetailed purchase calculation:");
        console.log("MIN_PURCHASE_TOKENS (raw):", minPurchaseTokens.toString());
        console.log("MIN_PURCHASE_TOKENS (formatted):", ethers.utils.formatEther(minPurchaseTokens));
        console.log("Token price (raw):", actualTokenPrice.toString());
        console.log("Token price (formatted):", ethers.utils.formatEther(actualTokenPrice));
        console.log("Safe purchase amount (raw):", safeAmount.toString());
        console.log("Safe purchase amount (formatted):", ethers.utils.formatEther(safeAmount));
        
        // Double check the contract's calculation
        const contractTokens = safeAmount.mul(ethers.utils.parseEther("1")).div(actualTokenPrice);
        console.log("Contract calculation (raw):", contractTokens.toString());
        console.log("Contract calculation (formatted):", ethers.utils.formatEther(contractTokens));
        console.log("Contract meets minimum?", contractTokens.gte(minPurchaseTokens));
        console.log("Is multiple of price?", safeAmount.mod(actualTokenPrice).eq(0));
        
        await xgenSale.connect(buyer).purchaseTokens({ value: safeAmount });
        const vestingBalance = await xgenToken.balanceOf(xgenVesting.address);
        expect(vestingBalance).to.be.gt(0);
    });
    
    it("Should successfully process a valid purchase", async function() {
        // Get contract values
        const minPurchaseTokens = await xgenSale.MIN_PURCHASE_TOKENS();
        const actualTokenPrice = await xgenSale.tokenPrice();
        
        console.log("\nContract Constants:");
        console.log("MIN_PURCHASE_TOKENS:", ethers.utils.formatEther(minPurchaseTokens), "tokens");
        console.log("Token price:", ethers.utils.formatEther(actualTokenPrice), "ETH per token");
        
        // Calculate required ETH for minimum purchase
        // We need to buy at least MIN_PURCHASE_TOKENS
        // Cost = MIN_PURCHASE_TOKENS * tokenPrice
        const requiredEth = minPurchaseTokens.mul(actualTokenPrice).div(ethers.utils.parseEther("1"));
        
        // Add 10% extra to be safe
        const safeAmount = requiredEth.mul(110).div(100);
        
        console.log("\nCalculation Details:");
        console.log("Required ETH for min purchase:", ethers.utils.formatEther(requiredEth), "ETH");
        console.log("Safe amount (110%):", ethers.utils.formatEther(safeAmount), "ETH");
        
        // Verify our calculations
        const tokensToReceive = safeAmount.mul(ethers.utils.parseEther("1")).div(actualTokenPrice);
        console.log("\nVerification:");
        console.log("Tokens we'll receive:", ethers.utils.formatEther(tokensToReceive), "tokens");
        console.log("Meets minimum?", tokensToReceive.gte(minPurchaseTokens));
        console.log("Is amount multiple of price?", safeAmount.mod(actualTokenPrice).eq(0));
        
        await expect(
            xgenSale.connect(buyer).purchaseTokens({ value: safeAmount })
        ).to.not.be.reverted;
    });
}); 