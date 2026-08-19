// Usage: npx hardhat run scripts/deploy.js --network <network>
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Update these values before running, or leave as defaults to deploy to mainnet router
  const initialReceiver = "0x4E9893B14B15A2f938dbc44BB427ef6Cd858CFec"; // recipient of initial supply
  const routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap V2 router (Ethereum mainnet)

  const Token = await hre.ethers.getContractFactory("UbiquitousEnigma");
  const token = await Token.deploy(initialReceiver, routerAddress);
  await token.deployed();

  console.log("UbiquitousEnigma deployed to:", token.address);
  console.log("Initial supply minted to:", initialReceiver);
  console.log("Owner (deployer):", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
