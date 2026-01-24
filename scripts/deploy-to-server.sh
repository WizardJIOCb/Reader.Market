#!/bin/bash

# Deployment script for reader.market
# Run this from your local machine after committing changes

SERVER="82.146.42.213"
PROJECT_PATH="/var/www/reader.market"

echo "Starting deployment to $SERVER..."

# 1. Commit local changes (if any)
echo "Committing local changes..."
git add .
git commit -m "Deployment commit $(date)" || echo "No changes to commit"

# 2. Push to remote repository
echo "Pushing to remote..."
git push origin main

# 3. Deploy to server via rsync (alternative to git pull)
echo "Deploying files to server..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'dist-client' ./ root@$SERVER:$PROJECT_PATH/

# 4. SSH commands to restart services
echo "Restarting services on server..."
ssh root@$SERVER << 'EOF'
cd /var/www/reader.market

# Install dependencies if package.json changed
if [ -f package.json ]; then
    npm install --production
fi

# Stop existing processes
pm2 stop reader-market || true
pm2 delete reader-market || true

# Start the application
pm2 start ecosystem.config.cjs --name reader-market

# Save PM2 processes
pm2 save

echo "Deployment completed!"
echo "Application is running at https://reader.market"
EOF

echo "Deployment finished!"