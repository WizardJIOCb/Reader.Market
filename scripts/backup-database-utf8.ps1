# PowerShell Script for Database Backup with UTF-8 encoding
# Usage: .\scripts\backup-database-utf8.ps1

param(
    [Parameter(Mandatory=$false)]
    [switch]$Manual
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectRoot "backups"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = "backup_$Timestamp.sql"
$ManualMode = $Manual

# Create backup directory if it doesn't exist
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force
}

# Database configuration from .env file
$EnvFile = Join-Path $ProjectRoot ".env"
if (Test-Path $EnvFile) {
    $DbUrlLine = Get-Content $EnvFile | Where-Object { $_ -match "^DATABASE_URL=" }
    if ($DbUrlLine) {
        $DbUrl = ($DbUrlLine -split '=')[1]
        if ($DbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)') {
            $DbUser = $Matches[1]
            $DbPass = $Matches[2]
            $DbHost = $Matches[3]
            $DbPort = $Matches[4]
            $DbName = $Matches[5]
        } else {
            Write-Error "Error: Could not parse DATABASE_URL from .env file"
            exit 1
        }
    } else {
        Write-Error "Error: DATABASE_URL not found in .env file"
        exit 1
    }
} else {
    # Fallback to default values
    $DbUser = "booksuser"
    $DbPass = "bookspassword"
    $DbHost = "localhost"
    $DbPort = "5432"
    $DbName = "booksdb"
}

Write-Host "Starting database backup with UTF-8 encoding..."

# Prepare the pg_dump command with explicit UTF-8 encoding
$PgDumpArgs = @(
    "--host=$DbHost",
    "--port=$DbPort",
    "--username=$DbUser",
    "--dbname=$DbName",
    "--verbose",
    "--clean",
    "--no-owner",
    "--no-privileges",
    "--encoding=UTF8",
    "--file=$(Join-Path $BackupDir $BackupFile)"
)

# Execute backup with environment variable for password
$env:PGPASSWORD = $DbPass
try {
    $Result = & pg_dump @PgDumpArgs 2>&1
    if ($LASTEXITCODE -eq 0) {
        $FileSize = (Get-Item (Join-Path $BackupDir $BackupFile)).Length
        $FileSizeMB = [math]::Round($FileSize / 1MB, 2)
        
        Write-Host "Backup completed successfully!"
        Write-Host "Backup file: $(Join-Path $BackupDir $BackupFile)"
        Write-Host "File size: $FileSizeMB MB"
        Write-Host "Timestamp: $Timestamp"
        Write-Host "Encoding: UTF-8"
        
        # Log to file
        $LogEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Backup created: $BackupFile (Size: $FileSizeMB MB, UTF-8 encoded)"
        Add-Content -Path "$(Join-Path $BackupDir 'backup.log')" -Value $LogEntry
        
        if ($ManualMode) {
            Write-Host ""
            Write-Host "Manual backup completed. Press Enter to exit..."
            Read-Host
        }
    } else {
        Write-Error "Error: Backup failed"
        Write-Host $Result
        exit 1
    }
} finally {
    # Cleanup
    Remove-Item env:PGPASSWORD
}