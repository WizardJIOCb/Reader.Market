#!/bin/bash

# PostgreSQL Database Restore Script for Ubuntu/Linux
# Usage: ./scripts/restore-database.sh [backup_filename.sql]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
BACKUP_FILE=""

# Database configuration from .env file
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
    DB_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2)
    if [[ -n "$DB_URL" ]]; then
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
    DB_USER="booksuser"
    DB_PASS="bookspassword"
    DB_HOST="localhost"
    DB_PORT="5432"
    DB_NAME="booksdb"
fi

# Function to list backups
list_backups() {
    echo "Available backup files:"
    echo "========================"
    
    BACKUP_FILES=($(find "$BACKUP_DIR" -name "backup_*.sql" -type f | sort -r))
    
    if [[ ${#BACKUP_FILES[@]} -eq 0 ]]; then
        echo "No backup files found in $BACKUP_DIR"
        exit 1
    fi
    
    for i in "${!BACKUP_FILES[@]}"; do
        FILE="${BACKUP_FILES[$i]}"
        FILENAME=$(basename "$FILE")
        SIZE=$(stat -c%s "$FILE")
        SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
        DATE=$(stat -c '%y' "$FILE" | cut -d'.' -f1)
        echo "$((i+1)). $FILENAME (${SIZE_MB} MB) - $DATE"
    done
}

# Check if backup file parameter is provided
if [[ $# -eq 0 ]]; then
    list_backups
    echo ""
    read -p "Enter the number of the backup to restore (1-${#BACKUP_FILES[@]}): " CHOICE
    
    if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [[ $CHOICE -lt 1 ]] || [[ $CHOICE -gt ${#BACKUP_FILES[@]} ]]; then
        echo "Invalid selection"
        exit 1
    fi
    
    BACKUP_FILE=$(basename "${BACKUP_FILES[$((CHOICE-1))]}")
else
    BACKUP_FILE="$1"
fi

# Verify backup file exists
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"
if [[ ! -f "$BACKUP_PATH" ]]; then
    echo "Error: Backup file not found: $BACKUP_PATH"
    exit 1
fi

# Confirmation with multiple security checks
echo ""
echo "⚠️  ⚠️  ⚠️  DATABASE RESTORE WARNING ⚠️  ⚠️  ⚠️"
echo "==================================================="
echo "THIS WILL COMPLETELY OVERWRITE YOUR CURRENT DATABASE!"
echo "ALL CURRENT DATA WILL BE PERMANENTLY LOST!"
echo "==================================================="
echo ""
echo "Backup file to restore: $BACKUP_FILE"
echo "Target database: $DB_NAME"
echo "Backup size: $(stat -c%s "$BACKUP_PATH" | awk '{printf "%.2f", $1/1024/1024}') MB"
echo "Backup date: $(stat -c '%y' "$BACKUP_PATH" | cut -d'.' -f1)"
echo ""
echo "Security Verification Required:"
echo "1. Type exactly: RESTORE_DATABASE_NOW"
echo "2. Then type your confirmation phrase: I_UNDERSTAND_THE_RISK"
echo ""

# First confirmation
read -p "Step 1 - Type 'RESTORE_DATABASE_NOW': " CONFIRMATION1

if [[ "$CONFIRMATION1" != "RESTORE_DATABASE_NOW" ]]; then
    echo "Restore cancelled - incorrect first confirmation."
    exit 0
fi

# Second confirmation
read -p "Step 2 - Type 'I_UNDERSTAND_THE_RISK': " CONFIRMATION2

if [[ "$CONFIRMATION2" != "I_UNDERSTAND_THE_RISK" ]]; then
    echo "Restore cancelled - incorrect second confirmation."
    exit 0
fi

echo ""
echo "⚠️  FINAL WARNING: This operation cannot be undone!"
echo ""

# Final confirmation
read -p "Type 'PROCEED' to execute database restore NOW: " FINAL_CONFIRMATION

if [[ "$FINAL_CONFIRMATION" != "PROCEED" ]]; then
    echo "Restore cancelled - final confirmation not given."
    exit 0
fi

# Set environment variable for password
export PGPASSWORD="$DB_PASS"

# Function to cleanup on exit
cleanup() {
    unset PGPASSWORD
}
trap cleanup EXIT

echo "Starting database restore..."
echo "This may take several minutes depending on database size..."

# Execute restore
psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --file="$BACKUP_PATH"

# Check if restore was successful
if [[ $? -eq 0 ]]; then
    echo "Restore completed successfully!"
    echo "Database has been restored from: $BACKUP_FILE"
    
    # Log to file
    LOG_ENTRY="$(date '+%Y-%m-%d %H:%M:%S') - Database restored from: $BACKUP_FILE"
    echo "$LOG_ENTRY" >> "$BACKUP_DIR/restore.log"
else
    echo "Error: Restore failed"
    exit 1
fi

echo ""
echo "Press Enter to exit..."
read