# PostgreSQL Database Backup Script for Windows (Docker Version)
# Usage: .\scripts\backup-database-docker.ps1 [-Manual]

param(
    [switch]$Manual = $false
)

# Configuration
$ProjectRoot = $PSScriptRoot
$BackupDir = Join-Path $ProjectRoot "..\backups" | Resolve-Path
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = "backup_$Timestamp.sql"
$ContainerName = "postgres-db"

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

# Check if Docker is available
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not found. Please ensure Docker Desktop is installed and running."
    exit 1
}

# Check if PostgreSQL container is running
$containerStatus = docker ps --filter "name=$ContainerName" --format "{{.Status}}"
if (-not $containerStatus) {
    Write-Error "PostgreSQL container '$ContainerName' is not running."
    Write-Host "Please start the container with: docker start $ContainerName" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using PostgreSQL Docker container: $ContainerName" -ForegroundColor Green

try {
    Write-Host "Starting database backup..." -ForegroundColor Green
    
    # Execute backup using docker exec
    $BackupPath = Join-Path $BackupDir $BackupFile
    
    # Set the password as environment variable for the docker exec command
    $env:PGPASSWORD = $DB_PASS
    
    # Execute pg_dump inside the container and save output to local file
    $cmd = "docker exec -e PGPASSWORD='$DB_PASS' $ContainerName pg_dump --username=$DB_USER --dbname=$DB_NAME --verbose --clean --no-owner --no-privileges"
    
    # Execute the command and save output to file
    Invoke-Expression $cmd | Out-File -FilePath $BackupPath -Encoding UTF8
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $BackupPath)) {
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
        if (Test-Path $BackupPath) {
            Remove-Item $BackupPath -Force
        }
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