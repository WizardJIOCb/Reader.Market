#!/bin/bash

# PostgreSQL Database Backup Script for Ubuntu/Linux with UTF-8 encoding
# Usage: ./scripts/backup-database.sh [manual]

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="backup_$TIMESTAMP.sql"
MANUAL_MODE=false

# Check if manual mode is requested
if [[ "$1" == "manual" ]]; then
    MANUAL_MODE=true
fi

# Database configuration from .env file
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
    # Extract DATABASE_URL
    DB_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2)
    if [[ -n "$DB_URL" ]]; then
        # Parse PostgreSQL URL: postgresql://user:pass@host:port/dbname
        if [[ $DB_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+) ]]; then
            DB_USER="${BASH_REMATCH[1]}"
            DB_PASS="${BASH_REMATCH[2]}"
            DB_HOST="${BASH_REMATCH[3]}"
            DB_PORT="${BASH_REMATCH[4]}"
            DB_NAME="${BASH_REMATCH[5]}"
        else
            echo "Error: Could not parse DATABASE_URL from .env file"
            exit 1
        fi
    else
        echo "Error: DATABASE_URL not found in .env file"
        exit 1
    fi
else
    # Fallback to default values
    DB_USER="booksuser"
    DB_PASS="bookspassword"
    DB_HOST="localhost"
    DB_PORT="5432"
    DB_NAME="booksdb"
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Set environment variable for password
export PGPASSWORD="$DB_PASS"

# Function to cleanup on exit
cleanup() {
    unset PGPASSWORD
}
trap cleanup EXIT

echo "Starting database backup with UTF-8 encoding..."

# Execute backup with explicit UTF-8 encoding
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --verbose \
    --clean \
    --no-owner \
    --no-privileges \
    --encoding=UTF8 \
    --file="$BACKUP_DIR/$BACKUP_FILE"

# Check if backup was successful
if [[ $? -eq 0 ]]; then
    FILE_SIZE=$(stat -c%s "$BACKUP_DIR/$BACKUP_FILE")
    FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1024 / 1024" | bc)
    
    echo "Backup completed successfully!"
    echo "Backup file: $BACKUP_DIR/$BACKUP_FILE"
    echo "File size: ${FILE_SIZE_MB} MB"
    echo "Timestamp: $TIMESTAMP"
    echo "Encoding: UTF-8"
    
    # Log to file
    LOG_ENTRY="$(date '+%Y-%m-%d %H:%M:%S') - Backup created: $BACKUP_FILE (Size: ${FILE_SIZE_MB} MB, UTF-8 encoded)"
    echo "$LOG_ENTRY" >> "$BACKUP_DIR/backup.log"
    
    if [[ "$MANUAL_MODE" == true ]]; then
        echo ""
        echo "Manual backup completed. Press Enter to exit..."
        read
    fi
else
    echo "Error: Backup failed"
    exit 1
fi