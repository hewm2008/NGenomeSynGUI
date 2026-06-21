#!/bin/bash
# NGenomeSyn Web Interface - Start Script
# Usage: ./start.sh [port]

PORT=${1:-1688}
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting NGenomeSyn Web Interface on port $PORT ..."
echo "Open http://127.0.0.1:$PORT in your browser"
echo ""

cd "$DIR/web" || { echo "Error: web/ directory not found"; exit 1; }

if command -v gunicorn &>/dev/null; then
  echo "[using gunicorn]"
  exec gunicorn -w 4 -b 0.0.0.0:$PORT app:app
else
  echo "[using flask dev server - install gunicorn for production]"
  exec python3 app.py "$PORT"
fi
