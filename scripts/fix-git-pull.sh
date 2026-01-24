#!/bin/bash
# Quick fix script to resolve git pull conflict on server

# Run this directly on the server:
# cd /var/www/reader.market
# bash fix-git-pull.sh

echo "Fixing git pull conflict..."

# Option 1: Stash local changes and pull
echo "Stashing local changes..."
git stash

echo "Pulling latest changes..."
git pull

echo "Restoring stashed changes..."
git stash pop

# Option 2: If you want to discard local changes instead:
# git reset --hard HEAD
# git pull

echo "Git pull completed!"
echo "Check status with: git status"