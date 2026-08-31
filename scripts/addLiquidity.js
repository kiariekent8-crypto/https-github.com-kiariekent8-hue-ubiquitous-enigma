// Usage: npx hardhat run scripts/addLiquidity.js --network <network>
// Make sure deployer has ETH and the token balance and that token address is correct.
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const routerAddress = "0xYOUR_ROUTER_ADDRESS"; // replace with real router (UniswapV2Router02)
  const tokenAddress = "0xYOUR_DEPLOYED_TOKEN_ADDRESS"; // replace with deployed token address
  const tokenAmount = ethers.utils.parseUnits("1000000.0", 18); // tokens to add
  const ethAmount = ethers.utils.parseEther("10.0"); // ETH to pair

  const routerAbi = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)"
  ];

  const router = new ethers.Contract(routerAddress, routerAbi, deployer);
  const token = await ethers.getContractAt("UbiquitousEnigma", tokenAddress);

  console.log("Approving router to spend tokens...");
  const approveTx = await token.approve(routerAddress, tokenAmount);
  await approveTx.wait();
  console.log("Approved.");

  console.log("Adding liquidity...");
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  const tx = await router.addLiquidityETH(
    tokenAddress,
    tokenAmount,
    0,
    0,
    deployer.address,
    deadline,
    { value: ethAmount }
  );
  await tx.wait();

  console.log("Liquidity added. Token:", tokenAddress, "Router:", routerAddress);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
