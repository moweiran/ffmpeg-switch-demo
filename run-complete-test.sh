#!/bin/bash

# Exit on any error
set -e

echo "Starting complete test environment..."

# Start RTMP server in background
echo "Starting RTMP server..."
docker-compose up -d rtmp-server

# Wait for RTMP server to be ready
echo "Waiting for RTMP server to start..."
sleep 10

# Start NestJS application in background
echo "Starting NestJS application..."
yarn start &

# Wait for NestJS app to be ready
echo "Waiting for NestJS application to start..."
sleep 10

# Run the test script
echo "Running test sequence..."
node test-streaming.js

# Stop all services
echo "Stopping services..."
docker-compose down

echo "Test completed successfully!"