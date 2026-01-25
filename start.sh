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

echo "Starting frontend..."
cd "$ROOT_DIR/frontend"
python3 -m http.server 5500 &
FRONTEND_PID=$!

echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Open: http://localhost:5500/index.html"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID" INT
wait
