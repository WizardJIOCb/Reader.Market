#!/bin/bash

# Deployment script for production server
echo "Starting deployment to production server..."

# Build the frontend
echo "Building frontend..."
npm run build

# Copy built files to production
echo "Copying files to production server..."
scp -r dist/* root@82.146.42.213:/var/www/reader.market/dist/

# Copy nginx config and reload
echo "Updating nginx configuration..."
scp reader.market.nginx root@82.146.42.213:/etc/nginx/sites-available/reader.market
ssh root@82.146.42.213 "nginx -t && systemctl reload nginx"

# Restart the server
echo "Restarting server..."
ssh root@82.146.42.213 "cd /var/www/reader.market && pm2 restart all"

echo "Deployment completed!"