#!/usr/bin/env bash
set -euo pipefail

# setup_debug.sh
# Installs dependencies, creates .env from .env.example if missing,
# starts a Hardhat mainnet fork in the background and compiles the project.

ENV_FILE=.env
EXAMPLE=.env.example
FORK_RPC_URL=${RPC_URL:-}

if [[ ! -f $ENV_FILE ]]; then
  if [[ -f scripts/debug/.env.example ]]; then
    cp scripts/debug/.env.example $ENV_FILE
    echo "Created $ENV_FILE from example. Edit it and add your private key locally (do not commit)."
  else
    echo "No .env.example found — create $ENV_FILE with RPC_URL and PRIVATE_KEY"
  fi
fi

if [[ -z "$FORK_RPC_URL" ]]; then
  # Try to source .env if it exists to get RPC_URL
  if [[ -f $ENV_FILE ]]; then
    set -o allexport
    source $ENV_FILE
    set +o allexport
    FORK_RPC_URL=${RPC_URL:-}
  fi
fi

if [[ -z "$FORK_RPC_URL" ]]; then
  echo "Please set RPC_URL env var or add it to $ENV_FILE"
  exit 1
fi

echo "Installing dependencies..."
npm ci

echo "Compiling contracts..."
npx hardhat compile

# Start a hardhat node fork in background
FORK_PORT=8545
LOGFILE=hardhat-fork.log

if lsof -Pi :$FORK_PORT -sTCP:LISTEN -t >/dev/null ; then
  echo "Hardhat node already running on port $FORK_PORT"
else
  echo "Starting Hardhat node fork (RPC=$FORK_RPC_URL) on port $FORK_PORT..."
  nohup npx hardhat node --fork "$FORK_RPC_URL" --hostname 127.0.0.1 --port $FORK_PORT >"$LOGFILE" 2>&1 &
  sleep 2
  echo "Hardhat fork started (logs: $LOGFILE)"
fi

echo "Ready. Use network 'localhost' when running scripts against the fork."

