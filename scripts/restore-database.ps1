# PostgreSQL Database Restore Script for Windows
# Usage: .\scripts\restore-database.ps1 [-BackupFile "backup_filename.sql"]

param(
    [string]$BackupFile = "",
    [switch]$ListBackups = $false
)

# Configuration
$ScriptDir = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectRoot "backups"

# Database configuration from .env file
$EnvFile = Join-Path $ProjectRoot ".env"
if (Test-Path $EnvFile) {
    $envContent = Get-Content $EnvFile | Where-Object { $_ -match "^DATABASE_URL=(.+)$" }
    if ($envContent) {
        $dbUrl = $matches[1]
        # Parse DATABASE_URL
        if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)") {
            $DB_USER = $matches[1]
            $DB_PASS = $matches[2]
            $DB_HOST = $matches[3]
            $DB_PORT = $matches[4]
            $DB_NAME = $matches[5]
        } else {
            Write-Error "Could not parse DATABASE_URL from .env file"
            exit 1
        }
    } else {
        Write-Error "DATABASE_URL not found in .env file"
        exit 1
    }
} else {
    # Fallback to default values
    $DB_USER = "booksuser"
    $DB_PASS = "bookspassword"
    $DB_HOST = "localhost"
    $DB_PORT = "5432"
    $DB_NAME = "booksdb"
}

# List available backups
if ($ListBackups -or $BackupFile -eq "") {
    Write-Host "Available backup files:" -ForegroundColor Yellow
    Write-Host "========================" -ForegroundColor Yellow
    
    $backupFiles = Get-ChildItem -Path $BackupDir -Filter "backup_*.sql" | Sort-Object CreationTime -Descending
    
    if ($backupFiles.Count -eq 0) {
        Write-Host "No backup files found in $BackupDir" -ForegroundColor Red
        exit 1
    }
    
    for ($i = 0; $i -lt $backupFiles.Count; $i++) {
        $file = $backupFiles[$i]
        $size = [math]::Round($file.Length / 1MB, 2)
        $date = $file.CreationTime.ToString("yyyy-MM-dd HH:mm")
        Write-Host "$($i + 1). $($file.Name) ($size MB) - $date" -ForegroundColor Cyan
    }
    
    if ($ListBackups) {
        exit 0
    }
    
    Write-Host ""
    $choice = Read-Host "Enter the number of the backup to restore (1-$($backupFiles.Count))"
    
    if ($choice -match "^\d+$" -and [int]$choice -ge 1 -and [int]$choice -le $backupFiles.Count) {
        $BackupFile = $backupFiles[[int]$choice - 1].Name
    } else {
        Write-Error "Invalid selection"
        exit 1
    }
}

# Verify backup file exists
$BackupPath = Join-Path $BackupDir $BackupFile
if (!(Test-Path $BackupPath)) {
    Write-Error "Backup file not found: $BackupPath"
    exit 1
}

# Confirmation with multiple security checks
Write-Host ""
Write-Host "⚠️  ⚠️  ⚠️  DATABASE RESTORE WARNING ⚠️  ⚠️  ⚠️" -ForegroundColor Red
Write-Host "===================================================" -ForegroundColor Red
Write-Host "THIS WILL COMPLETELY OVERWRITE YOUR CURRENT DATABASE!" -ForegroundColor Red
Write-Host "ALL CURRENT DATA WILL BE PERMANENTLY LOST!" -ForegroundColor Red
Write-Host "===================================================" -ForegroundColor Red
Write-Host ""
Write-Host "Backup file to restore: $BackupFile" -ForegroundColor Yellow
Write-Host "Target database: $DB_NAME" -ForegroundColor Yellow
Write-Host "Backup size: $([math]::Round((Get-Item $BackupPath).Length / 1MB, 2)) MB" -ForegroundColor Yellow
Write-Host "Backup date: $((Get-Item $BackupPath).CreationTime)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Security Verification Required:" -ForegroundColor Cyan
Write-Host "1. Type exactly: RESTORE_DATABASE_NOW" -ForegroundColor Gray
Write-Host "2. Then type your confirmation phrase: I_UNDERSTAND_THE_RISK" -ForegroundColor Gray
Write-Host ""

# First confirmation
$confirmation1 = Read-Host "Step 1 - Type 'RESTORE_DATABASE_NOW'"
if ($confirmation1 -ne "RESTORE_DATABASE_NOW") {
    Write-Host "Restore cancelled - incorrect first confirmation." -ForegroundColor Yellow
    exit 0
}

# Second confirmation
$confirmation2 = Read-Host "Step 2 - Type 'I_UNDERSTAND_THE_RISK'"
if ($confirmation2 -ne "I_UNDERSTAND_THE_RISK") {
    Write-Host "Restore cancelled - incorrect second confirmation." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "⚠️  FINAL WARNING: This operation cannot be undone!" -ForegroundColor Red
Write-Host ""

# Final confirmation
$finalConfirmation = Read-Host "Type 'PROCEED' to execute database restore NOW"
if ($finalConfirmation -ne "PROCEED") {
    Write-Host "Restore cancelled - final confirmation not given." -ForegroundColor Yellow
    exit 0
}

# Find psql executable
$PsqlPaths = @(
    "psql",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe",
    "C:\Program Files\PostgreSQL\13\bin\psql.exe",
    "C:\Program Files\PostgreSQL\12\bin\psql.exe"
)

$PsqlPath = $null
foreach ($path in $PsqlPaths) {
    if (Get-Command $path -ErrorAction SilentlyContinue) {
        $PsqlPath = $path
        break
    }
}

if (-not $PsqlPath) {
    Write-Error "psql not found. Please ensure PostgreSQL is installed and in PATH, or install PostgreSQL client tools."
    Write-Host "Common installation paths checked:" -ForegroundColor Yellow
    Write-Host "  - C:\Program Files\PostgreSQL\16\bin\" -ForegroundColor Gray
    Write-Host "  - C:\Program Files\PostgreSQL\15\bin\" -ForegroundColor Gray
    Write-Host "  - Add PostgreSQL bin directory to your PATH environment variable" -ForegroundColor Gray
    exit 1
}

Write-Host "Using psql from: $PsqlPath" -ForegroundColor Green

# Set environment variables for password
$env:PGPASSWORD = $DB_PASS

try {
    Write-Host "Starting database restore..." -ForegroundColor Green
    Write-Host "This may take several minutes depending on database size..." -ForegroundColor Yellow
    
    # Execute restore
    & $PsqlPath --host=$DB_HOST --port=$DB_PORT --username=$DB_USER --dbname=$DB_NAME --file="$BackupPath"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Restore completed successfully!" -ForegroundColor Green
        Write-Host "Database has been restored from: $BackupFile" -ForegroundColor Cyan
        
        # Log to file
        $LogEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Database restored from: $BackupFile"
        Add-Content -Path (Join-Path $BackupDir "restore.log") -Value $LogEntry
    } else {
        Write-Error "Restore failed with exit code: $LASTEXITCODE"
        exit 1
    }
}
catch {
    Write-Error "An error occurred during restore: $($_.Exception.Message)"
    exit 1
}
finally {
    # Clear password from environment
    if (Test-Path Env:\PGPASSWORD) {
        Remove-Item Env:\PGPASSWORD
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")