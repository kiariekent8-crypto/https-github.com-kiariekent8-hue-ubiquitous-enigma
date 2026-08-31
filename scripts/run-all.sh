#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./scripts/run-all.sh --network sepolia [--deploy] [--add-liquidity] [--enable-trading]
# Example:
# RPC_URL="https://..." PRIVATE_KEY="0x..." \
# ROUTER_ADDRESS="0x7a250..." TOKEN_AMOUNT="100000" ETH_AMOUNT="0.5" \
# ./scripts/run-all.sh --network sepolia --deploy --add-liquidity --enable-trading

print_usage() {
  echo "Usage: $0 --network <network> [--deploy] [--add-liquidity] [--enable-trading]"
  exit 1
}

# Parse args
NETWORK=""
DO_DEPLOY=false
DO_LIQ=false
DO_ENABLE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network) NETWORK="$2"; shift 2 ;;
    --deploy) DO_DEPLOY=true; shift ;;
    --add-liquidity) DO_LIQ=true; shift ;;
    --enable-trading) DO_ENABLE=true; shift ;;
    -h|--help) print_usage ;;
    *) echo "Unknown arg: $1"; print_usage ;;
  esac
done

if [[ -z "$NETWORK" ]]; then
  echo "Error: --network is required"
  print_usage
fi

echo "Running project tasks on network: $NETWORK"
echo "Deploy: $DO_DEPLOY, Add liquidity: $DO_LIQ, Enable trading: $DO_ENABLE"

# Basic steps: install, compile
echo "1) Install dependencies (npm ci)..."
npm ci

echo "2) Compile contracts..."
npx hardhat compile

DEPLOYED_ADDRESS_FILE=".deployed_address"

if $DO_DEPLOY; then
  # Ensure RPC and PRIVATE_KEY present
  if [[ -z "${RPC_URL:-}" || -z "${PRIVATE_KEY:-}" ]]; then
    echo "RPC_URL and PRIVATE_KEY must be set in environment for deploy."
    exit 1
  fi

  echo "3) Deploying contract..."
  # run deploy script and capture output to parse deployed address
  npx hardhat run scripts/deployEUG.js --network "$NETWORK" | tee deploy_output.txt

  # Try to parse deployed address line "EUG deployed to: 0x..."
  DEPLOYED_ADDR=$(grep -Eo "EUG deployed to: 0x[0-9a-fA-F]{40}" deploy_output.txt | awk '{print $4}' | tail -n1 || true)
  if [[ -n "$DEPLOYED_ADDR" ]]; then
    echo "Parsed deployed address: $DEPLOYED_ADDR"
    echo "$DEPLOYED_ADDR" > "$DEPLOYED_ADDRESS_FILE"
    export TOKEN_ADDRESS="$DEPLOYED_ADDR"
  else
    echo "Warning: could not parse deployed address. Please set TOKEN_ADDRESS env var manually."
  fi
fi

# When adding liquidity, require ROUTER_ADDRESS, TOKEN_ADDRESS (or .deployed_address), PRIVATE_KEY, RPC_URL
if $DO_LIQ; then
  if [[ -z "${RPC_URL:-}" || -z "${PRIVATE_KEY:-}" ]]; then
    echo "RPC_URL and PRIVATE_KEY must be set for add-liquidity."
    exit 1
  fi

  # Determine token address
  if [[ -z "${TOKEN_ADDRESS:-}" ]]; then
    if [[ -f "$DEPLOYED_ADDRESS_FILE" ]]; then
      TOKEN_ADDRESS=$(cat "$DEPLOYED_ADDRESS_FILE")
      echo "Using token address from $DEPLOYED_ADDRESS_FILE: $TOKEN_ADDRESS"
    else
      echo "TOKEN_ADDRESS not set and no $DEPLOYED_ADDRESS_FILE found. Set TOKEN_ADDRESS env var."
      exit 1
    fi
  fi

  if [[ -z "${ROUTER_ADDRESS:-}" ]]; then
    echo "ROUTER_ADDRESS not set, defaulting to UniswapV2 mainnet router address."
    ROUTER_ADDRESS="0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  fi

  if [[ -z "${TOKEN_AMOUNT:-}" || -z "${ETH_AMOUNT:-}" ]]; then
    echo "TOKEN_AMOUNT and ETH_AMOUNT must be set as env vars for add-liquidity (e.g. TOKEN_AMOUNT=100000 ETH_AMOUNT=0.5)"
    exit 1
  fi

  echo "4) Adding liquidity for token $TOKEN_ADDRESS using router $ROUTER_ADDRESS"
  export ROUTER_ADDRESS TOKEN_ADDRESS
  # Run addLiquidity script reading env vars
  npx hardhat run scripts/addLiquidity.js --network "$NETWORK"
fi

if $DO_ENABLE; then
  if [[ -z "${RPC_URL:-}" || -z "${PRIVATE_KEY:-}" ]]; then
    echo "RPC_URL and PRIVATE_KEY must be set to call enable-trading."
    exit 1
  fi

  # Reuse TOKEN_ADDRESS detection
  if [[ -z "${TOKEN_ADDRESS:-}" ]]; then
    if [[ -f "$DEPLOYED_ADDRESS_FILE" ]]; then
      TOKEN_ADDRESS=$(cat "$DEPLOYED_ADDRESS_FILE")
      echo "Using token address from $DEPLOYED_ADDRESS_FILE: $TOKEN_ADDRESS"
    else
      echo "TOKEN_ADDRESS not set and no $DEPLOYED_ADDRESS_FILE found. Set TOKEN_ADDRESS env var."
      exit 1
    fi
  fi

  echo "5) Enabling trading for token $TOKEN_ADDRESS"
  node -e "(async () => { const hre = require('hardhat'); const ethers = hre.ethers; const signer = (await ethers.getSigners())[0]; const tokenAddress = process.env.TOKEN_ADDRESS || '$TOKEN_ADDRESS'; const token = await hre.ethers.getContractAt('EUG', tokenAddress, signer); console.log('Caller (should be owner):', signer.address); const tx = await token.enableTrading(); const receipt = await tx.wait(); console.log('enableTrading tx:', receipt.transactionHash); })().catch(e => { console.error(e); process.exit(1); });" --network "$NETWORK"
fi

echo "All requested tasks completed."
