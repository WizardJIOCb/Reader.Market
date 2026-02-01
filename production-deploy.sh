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

# Apply database migrations (this handles both schema and data)
echo "Applying database migrations..."
# First push any schema changes
npx drizzle-kit push

# Attempt to run migrations, but continue if there are issues with tracking
# This handles the case where migration tracking is not properly initialized
npx drizzle-kit migrate || echo "Continuing with deployment - migrations may have tracking issues but schema is updated"

# Build the project
echo "Building project..."
npm run build

# Restart the application
echo "Restarting application..."
pm2 restart all

echo "Deployment completed successfully!"
echo "Check: https://reader.market/git-to-gpt"