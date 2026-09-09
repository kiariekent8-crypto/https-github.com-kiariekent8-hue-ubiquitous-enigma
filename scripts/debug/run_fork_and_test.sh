#!/usr/bin/env bash
set -euo pipefail

# run_fork_and_test.sh
# Launches a mainnet fork (if not already running) and runs a quick verification

if [[ ! -f .env ]]; then
  echo ".env not found — copy scripts/debug/.env.example to .env and fill values before running."
  exit 1
fi

# Load env
set -o allexport
source .env
set +o allexport

# Start fork (if needed)
if ! lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null ; then
  echo "Starting hardhat fork..."
  npx hardhat node --fork "$RPC_URL" --hostname 127.0.0.1 --port 8545 &
  FORK_PID=$!
  echo "Hardhat fork started (PID=$FORK_PID)"
  # give it a moment
  sleep 3
else
  echo "Hardhat fork already running on port 8545"
fi

echo "Compiling contracts..."
npx hardhat compile

# Run verification script against localhost fork
echo "Running verify script against localhost..."
node scripts/verifyLiquidityMainnet.js --network localhost || true

echo "Done. Keep the fork running for further debugging (Ctrl+C to stop the fork if you started it here)."
