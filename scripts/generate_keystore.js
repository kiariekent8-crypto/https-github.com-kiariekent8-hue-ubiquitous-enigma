#!/usr/bin/env node
// scripts/generate_keystore.js
// Secure local keystore generator using ethers.js
// Generates a new random wallet, encrypts it with a password you supply via env var
// and writes an encrypted keystore JSON into ./keystores/.
// By default the mnemonic/private key are NOT printed; set SHOW_MNEMONIC=true to print the mnemonic locally.

// Usage (local machine only):
// 1) Install deps: npm ci
// 2) Set a strong password in env (do NOT commit it):
//    export KEYSTORE_PASSWORD="My$tr0ngP@ssw0rd"
// 3) (Optional) To see the mnemonic immediately (DO THIS ONLY LOCALLY):
//    export SHOW_MNEMONIC=true
// 4) Run:
//    node scripts/generate_keystore.js

const fs = require('fs');
const path = require('path');
const { Wallet } = require('ethers');

(async function main() {
  try {
    const password = process.env.KEYSTORE_PASSWORD;
    if (!password) {
      console.error('\nERROR: KEYSTORE_PASSWORD environment variable is required.');
      console.error('Set a strong password in your shell, e.g. export KEYSTORE_PASSWORD="My$tr0ngP@ss"');
      console.error('This script does NOT accept the password interactively to avoid accidental logging.');
      process.exit(1);
    }

    const showMnemonic = (process.env.SHOW_MNEMONIC || 'false').toLowerCase() === 'true';

    // Create directory
    const keystoreDir = path.join(process.cwd(), 'keystores');
    if (!fs.existsSync(keystoreDir)) fs.mkdirSync(keystoreDir, { recursive: true });

    // Create wallet
    const wallet = Wallet.createRandom();
    const address = wallet.address;

    console.log('Generated new wallet address:', address);

    if (showMnemonic) {
      console.log('\n*** MNEMONIC (store securely, do NOT share) ***');
      console.log(wallet.mnemonic.phrase);
      console.log('*** End mnemonic ***\n');
    } else {
      console.log('\nMnemonic not printed. If you want to print it now, set SHOW_MNEMONIC=true in your local environment.');
      console.log('IMPORTANT: If you do not capture the mnemonic now, you will NOT be able to recover the wallet from the keystore JSON alone without the mnemonic passphrase.');
    }

    // Encrypt wallet with the password
    console.log('Encrypting keystore (this may take a few seconds)...');
    const json = await wallet.encrypt(password, { scrypt: { N: 1 << 18 } }); // stronger scrypt params for improved security

    // Write keystore file: keystore-<address>-<timestamp>.json
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `keystore-${address}-${timestamp}.json`;
    const filepath = path.join(keystoreDir, filename);
    fs.writeFileSync(filepath, json, { encoding: 'utf8', flag: 'w' });

    // Set file permissions to user-only where supported
    try {
      fs.chmodSync(filepath, 0o600);
    } catch (e) {
      // ignore if not supported
    }

    console.log('Encrypted keystore written to:', filepath);
    console.log('\nNEXT STEPS:');
    console.log('- Move the keystore JSON to a secure location (offline if possible).');
    console.log('- Do NOT commit the keystore or password to any repository.');
    console.log('- If you printed the mnemonic, store it on paper/metal; never take photos or store in cloud.');
    console.log('- To use this keystore with ethers.js or other tools, decrypt it locally with the same password.');

  } catch (err) {
    console.error('Failed to generate keystore:', err);
    process.exit(1);
  }
})();
