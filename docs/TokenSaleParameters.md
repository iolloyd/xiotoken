# XIO Token Sale Parameters

## Token Sale Configuration

### Token Economics
Total Token Supply: 100,000,000 XGEN
Seed Round Allocation: 10,000,000 XGEN (10% of total supply)
Price per Token: $0.10 USD
Total Raise Target: $1,000,000 USD

### Sale Duration
Start Time: Day 1 at 14:00 UTC
Duration: 36 hours
End Time: Day 3 at 02:00 UTC

### Investment Parameters
Minimum Investment: $1,000 USD (10,000 XGEN)
Maximum Investment: $50,000 USD (500,000 XGEN)
Investment Structure: Flat rate, no tiers

### Vesting Schedule
Initial Unlock: 10% at TGE
Cliff Period: 6 months
Vesting Duration: 18 months total
Vesting Type: Linear monthly vesting after cliff

### Access Controls
Whitelist: Required
KYC: Basic KYC verification for all participants
Geographic Restrictions: Subject to legal compliance requirements

## Security Features

### Emergency Controls
- Emergency pause functionality implemented
- Multi-signature requirement for critical functions
- Rate limiting on large transactions

### Compliance Measures
- KYC verification system integration
- Geographic restriction enforcement
- Transaction monitoring system

## Technical Implementation Notes

### Smart Contract Requirements
- Implementation of vesting schedule using OpenZeppelin VestingWallet
- Integration with Fjord Foundry sale mechanism
- Implementation of whitelist functionality
- Emergency pause mechanisms
- Rate limiting for large transactions

### Monitoring Requirements
- Real-time sale progress tracking
- Vesting schedule monitoring
- Transaction volume monitoring
- Geographic restriction compliance

## Post-Sale Process

### Token Distribution
- Initial 10% distribution at TGE
- Vesting contract deployment for remaining 90%
- Monitoring system setup for vesting schedule

### Security Verification
- Final security audit of deployed contracts
- Verification of vesting contract parameters
- Confirmation of emergency controls