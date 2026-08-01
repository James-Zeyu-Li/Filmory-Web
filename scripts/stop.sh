#!/bin/bash

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🛑 Stopping Grainfolio-Web Stack..."

# 1. Kill backend and frontend processes running on local ports
echo "🔌 Stopping node processes on ports 8080 and 5173..."
BACKEND_PID=$(lsof -t -i:8080)
if [ ! -z "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null
    echo "✅ Stopped backend process ($BACKEND_PID)"
fi

FRONTEND_PID=$(lsof -t -i:5173)
if [ ! -z "$FRONTEND_PID" ]; then
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Stopped frontend process ($FRONTEND_PID)"
fi

# 2. Spin down Docker compose containers
if docker info >/dev/null 2>&1; then
    echo "📦 Stopping Docker containers..."
    cd "$PROJECT_ROOT"
    docker compose down
    echo "✅ Docker containers stopped."
else
    echo "⚠️ Docker is not running, skipped container shutdown."
fi

echo "🎉 Stack stopped successfully."
