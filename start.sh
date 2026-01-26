#!/usr/bin/env bash
set -e

# 1) Basic start (run this script): bash start.sh
# 2) After changing the database schema:
#    cd backend
#    npx prisma generate
#    npx prisma db push
#    Then restart this script or run: npm start

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend..."
cd "$ROOT_DIR/backend"
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
