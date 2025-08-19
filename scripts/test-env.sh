#!/bin/bash
# DevPocket Test Environment Setup Script

set -e

echo "Starting DevPocket test environment..."

# Function to check if service is ready
wait_for_service() {
    local service=$1
    local host=$2
    local port=$3
    local max_attempts=30
    local attempt=1

    echo "Waiting for $service to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if nc -z $host $port 2>/dev/null; then
            echo "$service is ready!"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: $service not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "Error: $service failed to start within expected time"
    return 1
}

# Start test containers
echo "Starting test containers..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.test.yml up -d
else
    docker compose -f docker-compose.test.yml up -d
fi

# Wait for services to be ready
wait_for_service "PostgreSQL" "localhost" "5432"
wait_for_service "Redis" "localhost" "6379"

# Run Prisma migrations
echo "Setting up test database schema..."
export DATABASE_URL="postgresql://postgres:postgresql@localhost:5432/devpocket_test?schema=public"
npx prisma db push --force-reset --skip-generate

echo "Test environment is ready!"
echo "You can now run tests with: pnpm test"