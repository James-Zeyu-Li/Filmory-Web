#!/bin/bash

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting Grainfolio-Web Development Stack..."

# 1. Verify Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop first!"
    exit 1
fi

echo "📦 Spinning up Docker infrastructure (Redis, MinIO, PostgreSQL)..."
cd "$PROJECT_ROOT"
docker compose up -d

# 2. Setup backend DB if dev.db doesn't exist
cd "$PROJECT_ROOT/backend"
if [ ! -f "prisma/dev.db" ]; then
    echo "🗄️ Database not found. Initializing SQLite database..."
    npx prisma db push
    echo "🌱 Seeding initial data..."
    npx ts-node prisma/seed.ts
fi

# 3. Start Backend in a new terminal window
echo "🟢 Launching Backend Service on port 8080..."
osascript -e "tell app \"Terminal\" to do script \"cd '$PROJECT_ROOT/backend' && npm run dev\""

# 4. Start Frontend in a new terminal window
echo "🔵 Launching Frontend App on port 5173..."
osascript -e "tell app \"Terminal\" to do script \"cd '$PROJECT_ROOT/frontend' && npm run dev\""

echo -e "\n🎉 All services started successfully!"
echo "-----------------------------------------------"
echo "🖥️  Frontend: http://localhost:5173"
echo "🔌 Backend:  http://localhost:8080"
echo "📦 MinIO Console: http://localhost:9001"
echo "-----------------------------------------------"
