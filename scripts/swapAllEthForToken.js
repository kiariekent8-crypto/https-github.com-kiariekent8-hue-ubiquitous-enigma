#!/usr/bin/env node
// scripts/swapAllEthForToken.js
// Swap (sell) almost all ETH balance into TOKEN using Uniswap V2-style router.
// Usage example (macOS/Linux):
// export RPC_URL="https://mainnet.infura.io/v3/YOUR_KEY"
// export PRIVATE_KEY="0xYOUR_KEY"
// export TOKEN_ADDRESS="0x4E9893B14B15A2f938dbc44BB427ef6Cd858CFec"
// export ROUTER_ADDRESS="0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"  # optional
// export GAS_BUFFER_ETH="0.01"   # keep this ETH to pay gas (default 0.01)
// export SLIPPAGE_PERCENT="1"    # percent tolerance (default 1%)
// node scripts/swapAllEthForToken.js --network mainnet

const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const signer = (await ethers.getSigners())[0];
  const provider = signer.provider;
  const network = hre.network.name;

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) throw new Error("Set TOKEN_ADDRESS env var to the target token address.");

  const routerAddress = process.env.ROUTER_ADDRESS || "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap V2 router
  const gasBufferEth = process.env.GAS_BUFFER_ETH || "0.01";
  const slippagePercent = Number(process.env.SLIPPAGE_PERCENT || "1");
  const deadlineSeconds = Number(process.env.DEADLINE_SECONDS || (60 * 10)); // 10 minutes default
  const gasLimit = process.env.GAS_LIMIT || "450000"; // adjust if needed

  console.log("Network:", network);
  console.log("Signer:", signer.address);
  console.log("Router:", routerAddress);
  console.log("Token:", tokenAddress);
  console.log("Gas buffer (ETH):", gasBufferEth);
  console.log("Slippage %:", slippagePercent);

  // ABIs
  const routerAbi = [
    "function WETH() view returns (address)",
    "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable"
  ];
  const tokenAbi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  const router = new ethers.Contract(routerAddress, routerAbi, signer);
  const token = new ethers.Contract(tokenAddress, tokenAbi, signer);

  // Get WETH address
  const weth = await router.WETH();

  // Get signer ETH balance
  const balance = await provider.getBalance(signer.address);
  console.log("Signer ETH balance:", ethers.utils.formatEther(balance), "ETH");

  const gasBuffer = ethers.utils.parseEther(String(gasBufferEth));
  if (balance.lte(gasBuffer)) {
    throw new Error(`ETH balance (${ethers.utils.formatEther(balance)} ETH) <= gas buffer (${gasBufferEth} ETH). Fund the account or reduce GAS_BUFFER_ETH.`);
  }

  const amountIn = balance.sub(gasBuffer); // use remaining ETH to swap
  console.log("ETH to spend in swap:", ethers.utils.formatEther(amountIn), "ETH");

  // Build path [WETH, token]
  const path = [weth, tokenAddress];

  // Compute expected output amounts (may revert if pair doesn't exist)
  let amountsOut;
  try {
    amountsOut = await router.getAmountsOut(amountIn, path);
  } catch (err) {
    console.error("getAmountsOut failed (pair may not exist or insufficient liquidity):", err.message);
    throw err;
  }
  const expectedTokens = amountsOut[amountsOut.length - 1];
  console.log("Expected token output (wei):", expectedTokens.toString());

  // Compute minimum based on slippage
  const slippageNumerator = Math.max(0, 100 - slippagePercent);
  const amountOutMin = expectedTokens.mul(slippageNumerator).div(100);
  console.log("Minimum tokens to accept (wei):", amountOutMin.toString());

  // Token balance before
  const beforeBalance = await token.balanceOf(signer.address);
  console.log("Token balance before swap:", beforeBalance.toString());

  // Deadline
  const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

  // Execute swap
  console.log("Sending swapExactETHForTokensSupportingFeeOnTransferTokens tx...");
  const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
    amountOutMin,
    path,
    signer.address,
    deadline,
    { value: amountIn, gasLimit: ethers.BigNumber.from(gasLimit) }
  );
  console.log("Swap tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Swap tx mined. block:", receipt.blockNumber, "status:", receipt.status);

  // Token balance after
  const afterBalance = await token.balanceOf(signer.address);
  console.log("Token balance after swap:", afterBalance.toString());
  const received = afterBalance.sub(beforeBalance);
  console.log("Received tokens (wei):", received.toString());

  // Optionally report token decimals/converted amount
  try {
    const decimals = await token.decimals();
    console.log("Received tokens (human):", ethers.utils.formatUnits(received, decimals));
  } catch (err) {
    console.warn("Token decimals() call failed; token may be non-standard.");
  }

  console.log("Done. Remaining ETH balance:", ethers.utils.formatEther(await provider.getBalance(signer.address)), "ETH");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exitCode = 1;
});
