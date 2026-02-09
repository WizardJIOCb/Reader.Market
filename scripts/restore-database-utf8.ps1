# PowerShell Script for Database Restore with UTF-8 encoding
# Usage: .\scripts\restore-database-utf8.ps1 [-BackupFile "backup_filename.sql"]

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectRoot "backups"

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

# If no backup file specified, list available backups and let user choose
if (-not $BackupFile) {
    Write-Host "Available backup files:"
    Write-Host "========================"
    
    $BackupFiles = Get-ChildItem -Path $BackupDir -Filter "backup_*.sql" | Sort-Object Name -Descending
    
    if ($BackupFiles.Count -eq 0) {
        Write-Error "No backup files found in $BackupDir"
        exit 1
    }
    
    for ($i = 0; $i -lt $BackupFiles.Count; $i++) {
        $File = $BackupFiles[$i]
        $FileSizeMB = [math]::Round($File.Length / 1MB, 2)
        $FileDate = $File.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        Write-Host "$($i + 1). $($File.Name) ($($FileSizeMB) MB) - $FileDate"
    }
    
    $Choice = Read-Host "Enter the number of the backup to restore (1-$($BackupFiles.Count))"
    $Index = [int]$Choice - 1
    
    if ($Index -lt 0 -or $Index -ge $BackupFiles.Count) {
        Write-Error "Invalid selection"
        exit 1
    }
    
    $BackupFile = $BackupFiles[$Index].Name
}

# Verify backup file exists
$BackupPath = Join-Path $BackupDir $BackupFile
if (!(Test-Path $BackupPath)) {
    Write-Error "Error: Backup file not found: $BackupPath"
    exit 1
}

# Get file size for display
$FileInfo = Get-Item $BackupPath
$FileSizeMB = [math]::Round($FileInfo.Length / 1MB, 2)
$FileDate = $FileInfo.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")

# Confirmation with multiple security checks
Write-Host ""
Write-Host "⚠️  ⚠️  ⚠️  DATABASE RESTORE WARNING ⚠️  ⚠️  ⚠️"
Write-Host "==================================================="
Write-Host "THIS WILL COMPLETELY OVERWRITE YOUR CURRENT DATABASE!"
Write-Host "ALL CURRENT DATA WILL BE PERMANENTLY LOST!"
Write-Host "==================================================="
Write-Host ""
Write-Host "Backup file to restore: $BackupFile"
Write-Host "Target database: $DbName"
Write-Host "Backup size: $FileSizeMB MB"
Write-Host "Backup date: $FileDate"
Write-Host ""

Write-Host "Security Verification Required:"
Write-Host "1. Type exactly: RESTORE_DATABASE_NOW"
Write-Host "2. Then type your confirmation phrase: I_UNDERSTAND_THE_RISK"
Write-Host ""

# First confirmation
$Confirmation1 = Read-Host "Step 1 - Type 'RESTORE_DATABASE_NOW'"
if ($Confirmation1 -ne "RESTORE_DATABASE_NOW") {
    Write-Host "Restore cancelled - incorrect first confirmation."
    exit 0
}

# Second confirmation
$Confirmation2 = Read-Host "Step 2 - Type 'I_UNDERSTAND_THE_RISK'"
if ($Confirmation2 -ne "I_UNDERSTAND_THE_RISK") {
    Write-Host "Restore cancelled - incorrect second confirmation."
    exit 0
}

Write-Host ""
Write-Host "⚠️  FINAL WARNING: This operation cannot be undone!"
Write-Host ""

# Final confirmation
$FinalConfirmation = Read-Host "Type 'PROCEED' to execute database restore NOW"
if ($FinalConfirmation -ne "PROCEED") {
    Write-Host "Restore cancelled - final confirmation not given."
    exit 0
}

Write-Host "Starting database restore with UTF-8 encoding..."
Write-Host "This may take several minutes depending on database size..."

# Prepare the psql command with explicit UTF-8 encoding
$PsqlArgs = @(
    "--host=$DbHost",
    "--port=$DbPort",
    "--username=$DbUser",
    "--dbname=$DbName",
    "--file=$BackupPath",
    "--set=client_encoding=utf8"
)

# Execute restore with environment variable for password
$env:PGPASSWORD = $DbPass
try {
    $Result = & psql @PsqlArgs 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Restore completed successfully!"
        Write-Host "Database has been restored from: $BackupFile"
        
        # Log to file
        $LogEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Database restored from: $BackupFile"
        Add-Content -Path "$(Join-Path $BackupDir 'restore.log')" -Value $LogEntry
    } else {
        Write-Error "Error: Restore failed"
        Write-Host $Result
        exit 1
    }
} finally {
    # Cleanup
    Remove-Item env:PGPASSWORD
}

Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host