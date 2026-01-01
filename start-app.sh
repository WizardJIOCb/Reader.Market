#!/bin/bash

# Ollama-Reader Application Startup Script

set -e  # Exit immediately if a command exits with a non-zero status

# Colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js before running this script."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm before running this script."
    exit 1
fi

print_status "Starting Ollama-Reader application startup process..."

# Install dependencies
print_status "Installing dependencies..."
npm install

# Run database migrations
print_status "Running database migrations..."
npx drizzle-kit push

# Start the application using the existing npm scripts
print_status "Starting Ollama-Reader application..."
npm run dev &
APP_PID=$!

# Function to handle script termination
cleanup() {
    print_status "Stopping application..."
    kill $APP_PID 2>/dev/null || true
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGINT SIGTERM

print_status "Ollama-Reader application is now running!"
print_status "Application PID: $APP_PID"
print_status "Press Ctrl+C to stop the application."

# Wait for the process
wait $APP_PID
