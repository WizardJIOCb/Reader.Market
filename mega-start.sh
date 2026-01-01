#!/bin/bash

# Ollama-Reader Production Deployment Script

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

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

print_status "Starting Ollama-Reader production deployment process..."

# Install dependencies
print_status "Installing dependencies..."
npm install

# Run database migrations
print_status "Running database migrations..."
npx drizzle-kit push

# Build the frontend for production
print_status "Building frontend for production..."
npm run build

# Export environment variables for production
print_status "Setting up environment variables..."
export NODE_ENV=production

# Start the application using PM2 for production in fork mode
print_status "Starting Ollama-Reader application on port 5001..."

# Check if the application is already running and restart if needed
if pm2 list | grep -q "ollama-reader"; then
    print_status "Application already running. Stopping..."
    pm2 stop ollama-reader
    pm2 delete ollama-reader
    print_status "Starting fresh instance..."
fi

# Start in fork mode with environment variables
pm2 start server/index.ts --name "ollama-reader" --interpreter tsx --node-args="--import=tsx" -- --port=5001 --update-env

print_status "Ollama-Reader application is now running!"
print_status "Use 'pm2 status' to check application status"
print_status "Use 'pm2 stop ollama-reader' to stop the application"
print_status "Use 'pm2 logs ollama-reader' to view application logs"
