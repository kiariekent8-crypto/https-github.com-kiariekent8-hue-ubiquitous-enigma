const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const EUG = await ethers.getContractFactory("EUGToken");

  // Configurable via env vars or fall back to sensible defaults
  const name = process.env.TOKEN_NAME || "EUG Token";
  const symbol = process.env.TOKEN_SYMBOL || "EUG";
  const initialSupply = ethers.utils.parseUnits(process.env.INITIAL_SUPPLY || "1000000", 18); // 1,000,000 default
  const initialRecipient = process.env.INITIAL_RECIPIENT || deployer.address;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const initialFeeBps = Number(process.env.INITIAL_FEE_BPS || "300"); // 300 = 3.00%
  const maxSupply = ethers.utils.parseUnits(process.env.MAX_SUPPLY || "1000000000", 18); // 1,000,000,000 default

  console.log("Token name:", name);
  console.log("Token symbol:", symbol);
  console.log("Initial supply (wei):", initialSupply.toString());
  console.log("Initial recipient:", initialRecipient);
  console.log("Fee recipient:", feeRecipient);
  console.log("Initial fee (bps):", initialFeeBps);
  console.log("Max supply (wei):", maxSupply.toString());

  // Deploy with 7 constructor args (name, symbol, initialSupply, initialRecipient, feeRecipient, initialFeeBps, maxSupply)
  const token = await EUG.deploy(
    name,
    symbol,
    initialSupply,
    initialRecipient,
    feeRecipient,
    initialFeeBps,
    maxSupply
  );

  await token.deployed();
  console.log("EUGToken deployed to:", token.address);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
