#!/bin/bash

# Production deployment script - run directly on the server
echo "Starting production deployment..."

# Navigate to project directory
cd /var/www/reader.market

# Pull latest changes from git
echo "Pulling latest changes from git..."
git pull origin main

# Install dependencies if needed
echo "Installing dependencies..."
npm install

# Build the project
echo "Building project..."
npm run build

# Restart the application
echo "Restarting application..."
pm2 restart all

echo "Deployment completed successfully!"
echo "Check: https://reader.market/git-to-gpt"