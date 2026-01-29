#!/bin/bash

# Deployment script for production server
echo "Starting deployment to production server..."

# Build the frontend
echo "Building frontend..."
npm run build

# Copy built files to production
echo "Copying files to production server..."
scp -r dist/* root@82.146.42.213:/var/www/reader.market/dist/

# Restart the server
echo "Restarting server..."
ssh root@82.146.42.213 "cd /var/www/reader.market && pm2 restart all"

echo "Deployment completed!"