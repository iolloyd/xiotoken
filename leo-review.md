Docs:
- TokenSaleParameters.docs describe that there will be 100M XGen, shouldn't this be 1B?
Overall:
- Optional: Update the contracts to use solidity +0.8.26, you will gain some features (require with custom errors), and some optimizations for free.
- Review if openzeppelin contracts +5 worth the upgrade. The ERCs smart contracts got optimized.
- Optional: Compile the smart contracts using the IR (intermediate representation) to optimize the bytecode. This will make the deployment cheaper: https://hardhat.org/hardhat-runner/docs/reference/solidity-support
- Optional: Require with custom error messages, this will make the deployment cheaper, and you also gain the possibility of sending a custom variables. https://soliditylang.org/blog/2024/05/21/solidity-0.8.26-release-announcement/ +0.8.27 supports this feature with legacy compilation pipeline.

XGen:
- We are minting all tokens (_totalSupply) to the deployer, _totalSupply gets assigned to the totalSupplyCap, so there's no way to mint more tokens, unless some get burned. Is this the expected behavior? I didn't see the other SC yet.
- function _beforeTokenTransfer: super._beforeTokenTransfer(from, to, amount); is not defined in the ERC20 contract, so calling it
  is not necessary. This function is meant to be overridden in the child contract, but it's not necessary to call the parent function. Warning: This function
  got deprecated in OpenZeppelin Contracts +5.x
- Any reason to  re-implement the decimals() function (conflicts with inherited contracts?). If you are using 18 decimals, it's already implemented in the ERC20 contract.
- Add whitelist as modifier (isWhitelisted(userAddress)). This will make the code more readable and easier to maintain.

XGENKYC:
- Change the layout of the struct to save gas with tight variable packing: https://fravoll.github.io/solidity-patterns/tight_variable_packing.html
```
struct KYCData {
        uint256 verificationDate;
        uint256 expiryDate;
        string verificationLevel;
        address verifier; #20 bytes, 12 bytes left
        bool verified; # 1 byte, this variable will be placed in the same slot as the address above
    }

struct VerificationRequest {
        string documentHash; #pointer 32 bytes
        uint256 timestamp; # 32 bytes
        address applicant; # 20 bytes, 12 bytes left, solidity can pack this variable with the ones below
        bool processed;
        bool approved;
    }
```
- IDK what will be the levels of the verification, but if you know them before hand, it may worth using an enum instead of a string. This will save gas, and you gain validation for free from the compiler.
- The restriction of the regions via `restrictedRegions[region]` is not being used anywhere in the contract. Where this validation should be done?

XGenMonitor:
- mapping(address => bool) public isParticipant; is not being used anywhere
- recordTransfer can only be called by the deployer (msg.sender). It will be done by an EOA, and on every transaction? This can be expensive, and it's not clear why this is necessary. This can be done off-chain, and the data can be queried when necessary.

XGenSale:

- Remember to add the XGenSale as MANAGER_ROLE in the XGenVesting, otherwise the sales will fail.
- updateKYCStatus and batchUpdateKYCStatus seem to be the same from the XGentKYC contract. Is this duplication expected, or the other contract will be removed?
- uint256 public constant PRICE = 100_000_000; not being used anywhere, and we pass the token price in the constructor.
- MIN_PURCHASE and MAX_PURCHASE are being compared against the msg.value, so the minimum requirement will be 1000 ether? Or that was suppose to be the minimum amount of tokens to be purchased?
- Make sure that the user sent msg.value amount to buy at least 1 token, and I would also enforce that the amount is a multiple of the token price, otherwise some ether would be suck by the contract.
- purchaseTokens: msg.value is already in WEI, not sure if you need to multiply 10^18 (line 123) there since token price will be probably in WEI as well.

XGenVesting:
- Remember to transfer XGen tokens to the contract. With a previous approval before deployment, you can do the transfer in the constructor.
- You don't need the `getAllocation(address beneficiary) ` function, since the mapping is public a getter will be automatically created for you.


TokenSwap:
- batchSwap is kinda meaningless and more expensive version of the `swap` function, as we are just summing all values sent, and doing 1 swap, why not just call swapTokens directly with the total sum?
- [Optional] Refactor _checkAndUpdateRateLimit to be a modifier to improve readability.

XIO:
- line 146, lastQuarterlyBurn = block.timestamp; doesn't need to be set here, as it will be set anyway on line 157.
- function _beforeTokenTransfer: super._beforeTokenTransfer(from, to, amount); is not defined in the ERC20 contract, so calling it
  is not necessary.
- is the emergencyMode ever used, couldn't find any reference on the XIO contract, we can enable it, but doesn't do anything.
- is `uint256 public constant BURN_PERCENTAGE` being used anywhere? It's not being used in the burn function.

XIOGovernance:
- Missing propose a proposal and vote functions. A good refence for this https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/Governor.sol

XIOTokenManager:
- Change order of the fields inside the TransferRequest struct to save gas```
struct TransferRequest {
        uint256 amount;
        uint256 executionTime;
        string purpose;
        bool executed;
        address recipient;
    }
```
- No need to to create getTransferRequest and deconstruct the strucutre, you can return it directly, and since the mapping is public, the getter is automatically created for you.