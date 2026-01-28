#!/bin/bash

# Setup Automated Daily Database Backups for Ubuntu
# This script sets up a cron job to run backups daily

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"

echo "Setting up automated database backups..."

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"
echo "Made backup script executable: $BACKUP_SCRIPT"

# Create backup directory
mkdir -p "$PROJECT_ROOT/backups"
echo "Created/verified backup directory: $PROJECT_ROOT/backups"

# Setup cron job for daily backups at 2 AM
CRON_JOB="0 2 * * * cd '$PROJECT_ROOT' && '$BACKUP_SCRIPT' >> '$PROJECT_ROOT/backups/backup-cron.log' 2>&1"

# Check if cron job already exists
(crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT") && {
    echo "Warning: Backup cron job already exists. Removing old entry..."
    crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -
}

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
echo "Added cron job: $CRON_JOB"

# Create log file
touch "$PROJECT_ROOT/backups/backup-cron.log"
chmod 644 "$PROJECT_ROOT/backups/backup-cron.log"

echo ""
echo "✅ Automated backup setup completed!"
echo ""
echo "Configuration:"
echo "- Backup time: Daily at 2:00 AM"
echo "- Backup script: $BACKUP_SCRIPT"
echo "- Backup directory: $PROJECT_ROOT/backups"
echo "- Log file: $PROJECT_ROOT/backups/backup-cron.log"
echo ""
echo "To check cron jobs: crontab -l"
echo "To remove cron job: crontab -e (and delete the backup line)"
echo "To view backup logs: tail -f $PROJECT_ROOT/backups/backup-cron.log"
echo ""
echo "Manual backup command: $BACKUP_SCRIPT manual"