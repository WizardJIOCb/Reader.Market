# Database Backups

This directory contains automated and manual database backups.

## Contents

- `backup_*.sql` - Database backup files (SQL format)
- `backup.log` - Log of all backup operations
- `restore.log` - Log of all restore operations  
- `cleanup.log` - Log of cleanup operations
- `backup-cron.log` - Log of automated backups (Ubuntu only)

## Usage

See the documentation in `../documentation/DATABASE_BACKUP_GUIDE.md` for detailed instructions.

## Quick Commands

**Windows (Docker):**
```cmd
# Manual backup
..\backup-manual-docker.bat

# Restore from backup
..\restore-docker.bat
```

**Windows (Native PostgreSQL):**
```cmd
# Manual backup
..\backup-manual.bat

# List available backups
powershell -ExecutionPolicy Bypass -File "..\scripts\restore-database.ps1" -ListBackups
```

**Ubuntu/Linux:**
```bash
# Manual backup
../scripts/backup-database.sh manual

# List available backups  
../scripts/restore-database.sh
```

## Retention Policy

By default, backups are kept for 30 days. Older backups can be cleaned up using the cleanup scripts.

## Security

- Keep backup files secure as they contain database data
- Consider encrypting backups if they contain sensitive information
- Restrict access to this directory appropriately