#!/bin/bash

# Cleanup Old Database Backups Script for Ubuntu/Linux
# Usage: ./scripts/cleanup-backups.sh [days] [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
DAYS=30
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            if [[ $1 =~ ^[0-9]+$ ]]; then
                DAYS=$1
            fi
            shift
            ;;
    esac
done

CUTOFF_DATE=$(date -d "$DAYS days ago" +%s)

echo "Database Backup Cleanup Script"
echo "==============================="
echo "Backup directory: $BACKUP_DIR"
echo "Retention period: $DAYS days"
echo "Cutoff date: $(date -d "@$CUTOFF_DATE" '+%Y-%m-%d')"
if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN MODE - No files will be deleted"
fi
echo ""

# Check if backup directory exists
if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "Error: Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# Find backup files older than cutoff date
mapfile -t OLD_FILES < <(find "$BACKUP_DIR" -name "backup_*.sql" -type f -mtime +$DAYS | sort)

if [[ ${#OLD_FILES[@]} -eq 0 ]]; then
    echo "No backup files older than $DAYS days found."
    exit 0
fi

echo "Found ${#OLD_FILES[@]} backup files to process:"
echo ""

TOTAL_SIZE=0
for file in "${OLD_FILES[@]}"; do
    FILENAME=$(basename "$file")
    SIZE_BYTES=$(stat -c%s "$file")
    SIZE_MB=$(echo "scale=2; $SIZE_BYTES / 1024 / 1024" | bc)
    TOTAL_SIZE=$(echo "$TOTAL_SIZE + $SIZE_MB" | bc)
    DATE=$(stat -c '%y' "$file" | cut -d'.' -f1)
    echo "  $FILENAME (${SIZE_MB} MB) - Created: $DATE"
done

echo ""
echo "Total space to free: ${TOTAL_SIZE} MB"

if [[ "$DRY_RUN" == true ]]; then
    echo ""
    echo "Dry run completed. No files were deleted."
    exit 0
fi

# Confirmation
echo ""
read -p "Type 'DELETE' to permanently remove these files: " CONFIRMATION

if [[ "$CONFIRMATION" != "DELETE" ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

# Delete files
echo ""
echo "Deleting old backup files..."

DELETED_COUNT=0
ERRORS=0

for file in "${OLD_FILES[@]}"; do
    if rm "$file" 2>/dev/null; then
        FILENAME=$(basename "$file")
        echo "  Deleted: $FILENAME"
        ((DELETED_COUNT++))
    else
        FILENAME=$(basename "$file")
        echo "  Error deleting: $FILENAME"
        ((ERRORS++))
    fi
done

# Log cleanup
LOG_ENTRY="$(date '+%Y-%m-%d %H:%M:%S') - Cleanup: Removed $DELETED_COUNT files, $ERRORS errors, freed ${TOTAL_SIZE} MB"
echo "$LOG_ENTRY" >> "$BACKUP_DIR/cleanup.log"

echo ""
echo "Cleanup completed!"
echo "  Files deleted: $DELETED_COUNT"
echo "  Errors: $ERRORS"
echo "  Space freed: ${TOTAL_SIZE} MB"

echo ""
echo "Press Enter to exit..."
read
