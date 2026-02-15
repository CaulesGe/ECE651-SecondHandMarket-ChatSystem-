#!/usr/bin/env bash
set -e

# Usage:
#   bash start.sh          - Start in development mode (backend + client separately)
#   bash start.sh --docker - Start with Docker (production build on port 3000)
#   bash start.sh -d       - Same as --docker
#
# After changing the database schema:
#   cd backend
#   npx prisma generate
#   npx prisma db push
#   Then restart this script or run: npm start

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check for Docker flag
if [[ "$1" == "--docker" || "$1" == "-d" ]]; then
    echo "Starting with Docker..."
    cd "$ROOT_DIR"
    
    # Build the Docker image
    echo "Building Docker image..."
    docker build -t secondhand-hub .
    
    echo ""
    echo "Starting Docker container..."
    echo "App will be available at: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop the container."
    echo ""
    
    # Run the container (foreground mode)
    docker run --rm -p 3000:3000 --name secondhand-hub-container secondhand-hub
    
    exit 0
fi

# Development mode (default)
echo "Starting in development mode..."

echo "Starting backend..."
cd "$ROOT_DIR/backend"
# Provide a default SQLite DB path for Prisma when DATABASE_URL is not set.
# Path is relative to backend/prisma/schema.prisma.
export DATABASE_URL="${DATABASE_URL:-file:../database/secondhand.db}"
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
