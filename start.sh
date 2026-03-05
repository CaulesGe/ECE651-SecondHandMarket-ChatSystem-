#!/usr/bin/env bash
set -e

# Usage:
#   bash start.sh          - Dev mode (backend + client separately)
#   bash start.sh --docker - Docker production mode (port 3000)
#   bash start.sh -d       - Same as --docker
#
# Env files:
#   .env.dev    - used in dev mode
#   .env.docker - used in docker mode

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

is_docker=false
if [[ "$1" == "--docker" || "$1" == "-d" ]]; then
  is_docker=true
fi

if $is_docker; then
  ENV_FILE="$ROOT_DIR/.env.docker"
else
  ENV_FILE="$ROOT_DIR/.env.dev"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing env file: $ENV_FILE"
  echo "Create it based on the corresponding .example file."
  exit 1
fi

echo "✅ Using env file: $ENV_FILE"

# -------------------------------------------------------------------
# Docker mode
# -------------------------------------------------------------------
if $is_docker; then
  echo "Starting with Docker..."
  cd "$ROOT_DIR"

  echo "Building Docker image..."
  docker build -t secondhand-hub .

  echo ""
  echo "Starting Docker container..."
  echo "App will be available at: http://localhost:3000"
  echo ""

  # IMPORTANT: pass env file into docker run so SMTP + CLIENT_URL are available.
  docker run --rm \
    --env-file "$ENV_FILE" \
    -p 3000:3000 \
    --name secondhand-hub-container \
    secondhand-hub

  exit 0
fi

# -------------------------------------------------------------------
# Dev mode (default)
# -------------------------------------------------------------------
echo "Starting in development mode..."

# Load env into current shell so prisma + node get consistent values
set -a
source "$ENV_FILE"
set +a

echo "Starting backend..."
cd "$ROOT_DIR/backend"
# Set development JWT secret if not provided by environment.
export JWT_SECRET="${JWT_SECRET:-dev-secret-change-me}"
# Provide a default SQLite DB path for Prisma when DATABASE_URL is not set.
# Path is relative to backend/prisma/schema.prisma.
export DATABASE_URL="${DATABASE_URL:-file:../database/secondhand.db}"
# Redis foundation flags (disabled by default until Redis is provisioned).
export REDIS_ENABLED="${REDIS_ENABLED:-true}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
npm install
npx prisma generate
npx prisma db push
npm start &
BACKEND_PID=$!

echo "Starting React client..."
cd "$ROOT_DIR/client"
npm install
npm run dev &
CLIENT_PID=$!

echo ""
echo "Backend PID: $BACKEND_PID (http://localhost:3000)"
echo "Client PID: $CLIENT_PID (http://localhost:5173)"
echo ""
echo "Open: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $CLIENT_PID" INT
wait
