# Database Backup Quick Reference

## 🚀 Quick Commands

### Windows

| Action | Command |
|--------|---------|
| **Manual Backup (Docker)** | `backup-manual-docker.bat` |
| **Manual Backup (Native)** | `backup-manual.bat` |
| **List Backups** | `.\scripts\restore-database.ps1 -ListBackups` |
| **Restore Backup** | `.\scripts\restore-database.ps1` |
| **Preview Cleanup** | `.\scripts\cleanup-backups.ps1 -Days 30 -DryRun` |
| **Clean Old Backups** | `.\scripts\cleanup-backups.ps1 -Days 30` |

### Ubuntu/Linux

| Action | Command |
|--------|---------|
| **Setup Auto Backups** | `chmod +x scripts/setup-auto-backup.sh && ./scripts/setup-auto-backup.sh` |
| **Manual Backup** | `./scripts/backup-database.sh manual` |
| **List Backups** | `./scripts/restore-database.sh` (shows list automatically) |
| **Restore Backup** | `./scripts/restore-database.sh` |
| **Preview Cleanup** | `./scripts/cleanup-backups.sh 30 --dry-run` |
| **Clean Old Backups** | `./scripts/cleanup-backups.sh 30` |

## 📁 File Locations

```
C:\Projects\reader.market\
├── backups/                    # All backup files stored here
│   ├── backup_*.sql           # Backup files
│   ├── backup.log             # Backup creation log
│   ├── restore.log            # Restore operations log
│   ├── cleanup.log            # Cleanup operations log
│   └── backup-cron.log        # Automated backup log (Ubuntu)
├── scripts/
│   ├── backup-database.ps1    # Windows backup script
│   ├── backup-database.sh     # Ubuntu backup script
│   ├── restore-database.ps1   # Windows restore script
│   ├── restore-database.sh    # Ubuntu restore script
│   ├── cleanup-backups.ps1    # Windows cleanup script
│   ├── cleanup-backups.sh     # Ubuntu cleanup script
│   └── setup-auto-backup.sh   # Ubuntu auto-backup setup
└── backup-manual.bat          # Windows manual backup wrapper
```

## ⏰ Automated Backup Schedule

**Ubuntu**: Daily at 2:00 AM (configured via cron)
**Windows**: Requires manual Task Scheduler setup

## 🗃️ Default Configuration

- **Database**: booksdb
- **User**: booksuser
- **Password**: bookspassword
- **Host**: localhost
- **Port**: 5432
- **Retention**: 30 days (for cleanup)

## 🔍 Monitoring

```bash
# View backup status
tail -20 backups/backup.log

# View automated backup logs (Ubuntu)
tail -20 backups/backup-cron.log

# Check backup directory size
du -sh backups/
```

## 🆘 Emergency Commands

```bash
# Immediate manual backup
./scripts/backup-database.sh manual  # Ubuntu
backup-manual.bat                   # Windows

# List all available backups
ls -la backups/backup_*.sql         # Ubuntu
dir backups\backup_*.sql            # Windows

# Check PostgreSQL connection
psql -U booksuser -d booksdb -c "SELECT version();"  # Both platforms
```