# Debugging & Development Guide

This folder collects helper scripts and instructions to debug and test the liquidity / trading / payment scripts locally using a mainnet fork. Follow the steps below to run a fast, reproducible debug environment.

IMPORTANT
- Never paste your real PRIVATE_KEY into a public location. Use environment variables and private local files.
- Test on a fork or testnet first; only run mainnet actions when you understand and reviewed the code.

Prerequisites
- Node 18+ and npm
- Git checkout of the repo on branch `feat/ueg-token`
- An Ethereum RPC provider URL that supports forking (e.g., Infura, Alchemy). Keep it secret.

Files in this folder
- setup_debug.sh — installs deps, creates .env from .env.example, starts a Hardhat node fork, compiles, and keeps the process running.
- run_fork_and_test.sh — start a fork and run a sample dry-run of verification & compute scripts against localhost fork.
- .env.example — example env variables you need to fill in locally.

Quick start (recommended)
1) Copy .env.example to .env and fill in values (do NOT include a real private key unless running locally):
   cp scripts/debug/.env.example .env
   # Edit .env locally with your editor (don't commit)

2) Install and compile
   npm ci
   npx hardhat compile

3) Start a mainnet fork and run a verification dry-run (keeps the fork running in a detached terminal):
   bash scripts/debug/run_fork_and_test.sh

What the debug runner does
- Starts a Hardhat node using `npx hardhat node --fork $RPC_URL` on port 8545
- Optionally impersonates an account or funds a test account with ETH
- Runs the verify script against the forked state to inspect reserves, price, and LP info

How to run a single script against the local fork
- Start the fork (if not started by the runner):
  npx hardhat node --fork $RPC_URL --hostname 127.0.0.1 --port 8545
- In another terminal, run scripts using the `localhost` network:
  node scripts/verifyLiquidityMainnet.js --network localhost

Debug tips
- Use `console.log` liberally in the scripts you want to debug.
- Run `node --inspect-brk scripts/yourScript.js --network localhost` and attach a debugger from your editor.
- Use `npx hardhat console --network localhost` to get a REPL connected to the fork.

Cleanup
- Stop the fork process (Ctrl+C) when done. Remove any local .env files containing private keys when not needed.

Contact
- If you want me to add a specific local test script (example: impersonate the token premint account and run addLiquidity), tell me which script to wire and I will add it to the runner.
