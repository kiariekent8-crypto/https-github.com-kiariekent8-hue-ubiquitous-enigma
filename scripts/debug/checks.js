# Debugging helper: quick sanity checks for required scripts and permissions

const fs = require('fs');
const required = [
  'scripts/addLiquidityMainnetV2.js',
  'scripts/verifyLiquidityMainnet.js',
  'scripts/swapAllEthForToken.js',
  'scripts/sendEthToRecipient.js'
];

let missing = [];
for (const r of required) {
  if (!fs.existsSync(r)) missing.push(r);
}
if (missing.length) {
  console.error('Missing files:', missing.join(', '));
  process.exit(1);
}
console.log('All required scripts present.');
console.log('Run `npm ci` and `npx hardhat compile` before running scripts.');
