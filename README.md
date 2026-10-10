# Ubiquitous Enigma (UEG)

Ubiquitous Enigma is an ERC-20 token with a transfer fee that accumulates tokens
for automatic liquidity operations through a Uniswap V2-compatible router.

## Contract overview

- Token name: `UbiquitousEnigma`
- Symbol: `UEG`
- Decimals: 18 (inherited from OpenZeppelin ERC-20)
- Initial supply: 10,000,000 UEG, minted to the constructor's
  `initialReceiver`
- Initial liquidity fee: 3% of transfers between non-excluded addresses
- Maximum owner-configurable liquidity fee: 10%
- Automatic swap threshold: 5,000 UEG by default
- Trading starts disabled. The owner enables it with `enableTrading()`.

When the contract has at least the configured threshold, a subsequent eligible
transfer triggers an automatic swap and liquidity operation. The fee is
collected in the token contract. The swap converts half of the accumulated
tokens to ETH and adds liquidity with the remaining tokens and received ETH.
LP tokens are sent to `owner()`.

## Important deployment considerations

**This contract should not be considered production-ready without further
review.**

- The swap currently sets `amountOutMin` to zero. It accepts any ETH output,
  leaving the operation exposed to poor execution and sandwiching. Configure
  appropriate slippage protection before deploying with real liquidity.
- LP tokens are sent to the owner, who can remove liquidity. Liquidity is not
  permanently locked.
- The router is immutable but trusted. The swap lock and transfer guard do not
  make an untrusted router safe.
- Owner-only rescue functions can transfer ETH and ERC-20 tokens held by the
  contract.
- Review the deployment script's hard-coded initial receiver and Ethereum
  mainnet Uniswap V2 router address before using it. The Hardhat configuration
  currently defines a compiler but does not configure external networks.

## Requirements

- Node.js 18 or later
- npm

## Install, compile, and test

```sh
npm ci
npx hardhat compile
npm test
```

The Hardhat test suite uses local mock factory and router contracts. It covers
the fee and trading controls, automatic swap/liquidity behavior, failure
rollback, a nested-transfer attempt during swapping, and rescue edge cases.

## Deployment

The deployment script accepts a Hardhat network name:

```sh
npx hardhat run scripts/deploy.js --network <network>
```

Configure the target network and its RPC credentials in Hardhat before use.
Update and verify `initialReceiver` and `routerAddress` in
[`scripts/deploy.js`](./scripts/deploy.js) for the intended chain. Do not deploy
using the script's current defaults without verifying the addresses and
deployment parameters.

## Owner controls

The owner can:

- Enable trading with `enableTrading()`
- Set the liquidity fee with `setLiquidityFee(uint256)` (maximum 10%)
- Set the automatic swap threshold with `setMinTokensBeforeSwap(uint256)`
- Enable or disable automatic liquidity with
  `setSwapAndLiquifyEnabled(bool)`
- Exclude or include an account from fees with
  `excludeFromFee(address,bool)`
- Rescue ETH or ERC-20 tokens held by the contract with `rescueETH` and
  `rescueERC20`

