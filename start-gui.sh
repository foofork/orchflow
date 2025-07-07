#!/bin/bash

# Start the orchestrator with GUI features
echo "Starting orchestrator with GUI features..."
cd orchestrator
npm run start:gui &
ORCHESTRATOR_PID=$!

# Wait for orchestrator to start
sleep 2

# Start the frontend
echo "Starting frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Orchestrator running on http://localhost:3000"
echo "Frontend running on http://localhost:5173"
echo "WebSocket on ws://localhost:8081"

# Function to handle cleanup
cleanup() {
    echo "Shutting down..."
    kill $ORCHESTRATOR_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait