# Deploy UbiquitousEnigma (UEG)

This branch adds an ERC20 token with auto-liquidity (swapAndLiquify) and scripts to deploy.

Important: I cannot deploy on-chain for you. The deploy script is provided and will mint the initial supply to the address you gave.

Prereqs
- Node.js (16+)
- Hardhat
- An account with ETH on the target network for gas / liquidity
- Do NOT paste private keys in public chat or repo.

Install

```bash
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers @openzeppelin/contracts
```

Compile

```bash
npx hardhat compile
```

Deploy (example — currently set to mint to 0x4E98... and use Uniswap V2 router on mainnet)

```bash
npx hardhat run scripts/deploy.js --network <network>
```

After deploy

1. Add liquidity: you can either use scripts/addLiquidity.js (edit token/router addresses) or allow the contract to accumulate fees and auto-add liquidity when the threshold is reached.
2. Once liquidity is in place, call enableTrading() from the owner account (scripts/enableTrading.js) to allow transfers.

Security & notes
- The deployer will be owner. Owner can change fees and thresholds. Keep the private key secure.
- Test thoroughly on a testnet before moving to mainnet.
