# Database Backup and Restore Guide

This guide explains how to backup and restore your PostgreSQL database using the provided scripts for both Windows and Ubuntu environments.

## 📁 Backup Structure

All backups are stored in the `backups/` directory in the project root:
```
c:\Projects\reader.market\backups/
├── backup_2026-01-28_23-45-01.sql
├── backup_2026-01-27_02-00-01.sql
├── backup_2026-01-26_02-00-01.sql
├── backup.log          # Backup creation logs
├── restore.log         # Restore operation logs
├── cleanup.log         # Cleanup operation logs
└── backup-cron.log     # Automated backup logs (Ubuntu only)
```

## 🖥️ Windows Usage

### Manual Backup

**Option 1: Using the Docker batch wrapper (recommended for Docker users)**
```cmd
backup-manual-docker.bat
```

**Option 2: Using the batch wrapper (requires PostgreSQL client tools)**
```cmd
backup-manual.bat
```

**Option 3: Direct PowerShell script**
```powershell
# For Docker-based PostgreSQL
.\scripts\backup-database-docker.ps1 -Manual

# For native PostgreSQL installation
.\scripts\backup-database.ps1 -Manual
```

### Automated Daily Backups

The Windows equivalent of cron jobs is Task Scheduler. You can set up a scheduled task to run:
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Projects\reader.market\scripts\backup-database.ps1"
```

### Restore Database

```powershell
.\scripts\restore-database.ps1
```

⚠️ **SECURITY WARNING**: This will show a list of available backups and require **three separate confirmations** before proceeding:
1. Type `RESTORE_DATABASE_NOW`
2. Type `I_UNDERSTAND_THE_RISK`
3. Type `PROCEED`

See [Restore Security Guide](RESTORE_SECURITY_GUIDE.md) for details.

### Cleanup Old Backups

```powershell
# Preview what would be deleted (30 days retention)
.\scripts\cleanup-backups.ps1 -Days 30 -DryRun

# Actually delete old backups
.\scripts\cleanup-backups.ps1 -Days 30
```

## 🐧 Ubuntu/Linux Usage

### Setup Automated Backups

First, make the setup script executable and run it:
```bash
chmod +x scripts/setup-auto-backup.sh
./scripts/setup-auto-backup.sh
```

This will:
- Make backup scripts executable
- Create the backups directory
- Set up a cron job to run daily at 2:00 AM
- Create log files

### Manual Backup

```bash
# Interactive mode (lists backups and asks for selection)
./scripts/backup-database.sh manual

# Direct backup (runs immediately)
./scripts/backup-database.sh
```

### Restore Database

```bash
# Interactive mode (lists backups and asks for selection)
./scripts/restore-database.sh

# Direct restore (specify backup file)
./scripts/restore-database.sh backup_2026-01-28_23-45-01.sql
```

### Cleanup Old Backups

```bash
# Preview what would be deleted (30 days retention)
./scripts/cleanup-backups.sh 30 --dry-run

# Actually delete old backups
./scripts/cleanup-backups.sh 30

# Custom retention period (e.g., 7 days)
./scripts/cleanup-backups.sh 7
```

### Managing Cron Jobs

```bash
# View current cron jobs
crontab -l

# Edit cron jobs
crontab -e

# Remove backup cron job
crontab -l | grep -v "backup-database.sh" | crontab -

# View backup logs
tail -f backups/backup-cron.log
```

## ⚙️ Configuration

The scripts automatically read database configuration from your `.env` file:

```env
DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
```

If no `.env` file is found, the scripts fall back to default values:
- Host: localhost
- Port: 5432
- Database: booksdb
- User: booksuser
- Password: bookspassword

## 🔧 Prerequisites

### Windows
- PostgreSQL installed with `pg_dump` and `psql` in PATH
- PowerShell 5.0 or later

### Ubuntu/Linux
- PostgreSQL client tools installed:
  ```bash
  sudo apt install postgresql-client
  ```
- `bc` calculator (usually pre-installed):
  ```bash
  sudo apt install bc
  ```

## 🛡️ Security Notes

1. **Password Handling**: Scripts temporarily set the `PGPASSWORD` environment variable and clear it after execution
2. **File Permissions**: Backup files are created with default permissions - consider restricting access if needed
3. **Network Security**: When backing up remote databases, ensure connections are secure
4. **Storage Security**: Store backups in a secure location, especially if they contain sensitive data

## 📊 Monitoring and Logs

### Backup Logs
- `backups/backup.log` - Records all backup operations
- `backups/backup-cron.log` - Automated backup logs (Ubuntu)

### Restore Logs
- `backups/restore.log` - Records all restore operations

### Cleanup Logs
- `backups/cleanup.log` - Records cleanup operations

View logs:
```bash
# Last 20 entries
tail -20 backups/backup.log

# Follow log in real-time
tail -f backups/backup.log
```

## 🚨 Emergency Procedures

### If Automated Backups Fail
1. Check `backups/backup-cron.log` for error details
2. Run manual backup to verify database accessibility
3. Check PostgreSQL service status
4. Verify disk space availability

### If Restore Fails
1. Check PostgreSQL service is running
2. Verify backup file integrity
3. Check database user permissions
4. Review `backups/restore.log` for details

### Disk Space Management
Regularly clean old backups:
```bash
# Check backup directory size
du -sh backups/

# Clean backups older than 30 days
./scripts/cleanup-backups.sh 30
```

## 🔄 Best Practices

1. **Test Restores Regularly**: Periodically test restoring from backups to verify integrity
2. **Monitor Backup Success**: Check logs regularly to ensure automated backups are working
3. **Multiple Retention Periods**: Keep some daily backups, weekly backups, and monthly backups
4. **Offsite Storage**: Copy critical backups to secure offsite storage
5. **Monitor Disk Space**: Set up alerts for low disk space on backup volume
6. **Version Control**: Keep backup scripts in version control

## 🆘 Troubleshooting

### Common Issues

**"pg_dump: command not found"**
- Ensure PostgreSQL bin directory is in PATH
- On Ubuntu: `sudo apt install postgresql-client`

**"Permission denied"**
- Check file permissions on backup directory
- Ensure user has write access to backups/ directory

**"Connection refused"**
- Verify PostgreSQL service is running
- Check database credentials in .env file
- Confirm database is accepting connections

**"No space left on device"**
- Clean old backups using cleanup script
- Check available disk space: `df -h`

### Getting Help

Check the logs first:
```bash
# View recent backup activity
tail -50 backups/backup.log

# View recent restore activity  
tail -50 backups/restore.log
```

For automated backup issues on Ubuntu:
```bash
# Check cron service
sudo systemctl status cron

# View cron logs
sudo tail -50 /var/log/syslog | grep CRON
```