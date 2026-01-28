# PostgreSQL Database Backup Script for Windows
# Usage: .\scripts\backup-database.ps1 [-Manual]

param(
    [switch]$Manual = $false
)

# Configuration
$ScriptDir = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectRoot "backups"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = "backup_$Timestamp.sql"

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

# Create backup directory if it doesn't exist
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force
}

# Find pg_dump executable
$PgDumpPaths = @(
    "pg_dump",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\13\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\12\bin\pg_dump.exe"
)

$PgDumpPath = $null
foreach ($path in $PgDumpPaths) {
    if (Get-Command $path -ErrorAction SilentlyContinue) {
        $PgDumpPath = $path
        break
    }
}

if (-not $PgDumpPath) {
    Write-Error "pg_dump not found. Please ensure PostgreSQL is installed and in PATH, or install PostgreSQL client tools."
    Write-Host "Common installation paths checked:" -ForegroundColor Yellow
    Write-Host "  - C:\Program Files\PostgreSQL\16\bin\" -ForegroundColor Gray
    Write-Host "  - C:\Program Files\PostgreSQL\15\bin\" -ForegroundColor Gray
    Write-Host "  - Add PostgreSQL bin directory to your PATH environment variable" -ForegroundColor Gray
    exit 1
}

Write-Host "Using pg_dump from: $PgDumpPath" -ForegroundColor Green

$BackupPath = Join-Path $BackupDir $BackupFile

# Set environment variables for password
$env:PGPASSWORD = $DB_PASS

try {
    Write-Host "Starting database backup..." -ForegroundColor Green
    
    # Execute backup
    & $PgDumpPath --host=$DB_HOST --port=$DB_PORT --username=$DB_USER --dbname=$DB_NAME --verbose --clean --no-owner --no-privileges --file="$BackupPath"
    
    if ($LASTEXITCODE -eq 0) {
        $FileSize = (Get-Item $BackupPath).Length / 1MB
        Write-Host "Backup completed successfully!" -ForegroundColor Green
        Write-Host "Backup file: $BackupPath" -ForegroundColor Cyan
        Write-Host "File size: $($FileSize.ToString("F2")) MB" -ForegroundColor Cyan
        Write-Host "Timestamp: $Timestamp" -ForegroundColor Cyan
        
        # Log to file
        $LogEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Backup created: $BackupFile (Size: $($FileSize.ToString("F2")) MB)"
        Add-Content -Path (Join-Path $BackupDir "backup.log") -Value $LogEntry
        
        if ($Manual) {
            Write-Host "`nManual backup completed. Press any key to exit..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    } else {
        Write-Error "Backup failed with exit code: $LASTEXITCODE"
        exit 1
    }
}
catch {
    Write-Error "An error occurred during backup: $($_.Exception.Message)"
    exit 1
}
finally {
    # Clear password from environment
    if (Test-Path Env:\PGPASSWORD) {
        Remove-Item Env:\PGPASSWORD
    }
}