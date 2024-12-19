describe("XGenVesting", function() {
    let XGenVesting;
    let vesting;
    let xgenToken;
    let owner;
    let addr1;
    let addr2;
    
    const CLIFF_DURATION = 180 * 24 * 60 * 60; // 180 days in seconds
    const VESTING_DURATION = 540 * 24 * 60 * 60; // 540 days in seconds
    
    beforeEach(async function() {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        // Deploy XGEN token first
        const XGEN = await ethers.getContractFactory("XGEN");
        xgenToken = await XGEN.deploy(
            "XGEN Token",
            "XGEN",
            ethers.utils.parseEther("1000000000"), // 1B total supply
            ethers.utils.parseEther("100000000"),  // 100M seed allocation
            ethers.utils.parseEther("0.1"),        // 0.1 ETH token price
            ethers.utils.parseEther("100000"),     // 100k rate limit
            3600                                   // 1 hour rate limit period
        );
        await xgenToken.deployed();
        
        // Deploy vesting contract
        XGenVesting = await ethers.getContractFactory("XGenVesting");
        vesting = await XGenVesting.deploy(
            xgenToken.address,
            CLIFF_DURATION,
            VESTING_DURATION
        );
        await vesting.deployed();
        
        // Approve and transfer tokens to vesting contract
        const vestingAmount = ethers.utils.parseEther("1000000");
        await xgenToken.approve(vesting.address, vestingAmount);
    });
    
    // ... rest of the tests
}); 