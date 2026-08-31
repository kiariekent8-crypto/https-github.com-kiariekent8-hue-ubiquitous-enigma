// Usage: npx hardhat run scripts/enableTrading.js --network <network>
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const tokenAddress = "0xYOUR_DEPLOYED_TOKEN_ADDRESS"; // replace
  const token = await hre.ethers.getContractAt("UbiquitousEnigma", tokenAddress, deployer);

  const tx = await token.enableTrading();
  await tx.wait();
  console.log("enableTrading called by:", deployer.address);
}

main().catch((e)=>{ console.error(e); process.exitCode = 1; });
