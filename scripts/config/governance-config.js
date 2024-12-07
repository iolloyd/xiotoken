module.exports = {
    // Governance parameters
    quorumThreshold: "100000", // 100k XIO tokens required for quorum
    proposalThreshold: "10000", // 10k XIO tokens required to create proposal
    executionDelay: 172800, // 2 days in seconds
    executionWindow: 432000, // 5 days in seconds
    
    // Token Manager parameters
    operatorLimit: "50000", // 50k XIO tokens per operator
    transferDelay: 86400, // 1 day in seconds
    
    // Snapshot space settings
    snapshot: {
        spaceName: "XIO DAO",
        domain: "snapshot.xio.network",
        about: "XIO DAO Governance",
        website: "https://xio.network",
        termsUrl: "https://docs.xio.network/terms",
        github: "https://github.com/xio-protocol",
        voting: {
            delay: 0,
            period: 259200, // 3 days
            type: "single-choice",
            quorum: 100000 // 100k XIO tokens
        },
        proposals: {
            threshold: 10000, // 10k XIO tokens
            validate: true,
            minScore: 0
        }
    },
    
    // Network-specific configurations
    networks: {
        mainnet: {
            xioTokenAddress: "", // To be filled after deployment
            snapshotSpace: "xio.eth",
            minGasPrice: "50000000000" // 50 gwei
        },
        base: {
            xioTokenAddress: "", // To be filled after deployment
            snapshotSpace: "xio.base",
            minGasPrice: "1000000000" // 1 gwei
        },
        hyperliquid: {
            xioTokenAddress: "", // To be filled after L1 deployment
            snapshotSpace: "xio.hyperliquid",
            minGasPrice: "1000000000" // 1 gwei
        }
    }
};