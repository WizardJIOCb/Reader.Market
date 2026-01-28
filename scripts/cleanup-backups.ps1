# Cleanup Old Database Backups Script for Windows
# Usage: .\scripts\cleanup-backups.ps1 [-Days 30] [-DryRun]

param(
    [int]$Days = 30,
    [switch]$DryRun = $false
)

# Configuration
$ProjectRoot = $PSScriptRoot
$BackupDir = Join-Path $ProjectRoot "..\backups" | Resolve-Path
$CutoffDate = (Get-Date).AddDays(-$Days)

Write-Host "Database Backup Cleanup Script" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green
Write-Host "Backup directory: $BackupDir" -ForegroundColor Cyan
Write-Host "Retention period: $Days days" -ForegroundColor Cyan
Write-Host "Cutoff date: $($CutoffDate.ToString('yyyy-MM-dd'))" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DRY RUN MODE - No files will be deleted" -ForegroundColor Yellow
}
Write-Host ""

# Check if backup directory exists
if (!(Test-Path $BackupDir)) {
    Write-Host "Backup directory not found: $BackupDir" -ForegroundColor Red
    exit 1
}

# Get backup files
$backupFiles = Get-ChildItem -Path $BackupDir -Filter "backup_*.sql" | Where-Object { $_.CreationTime -lt $CutoffDate }

if ($backupFiles.Count -eq 0) {
    Write-Host "No backup files older than $Days days found." -ForegroundColor Green
    exit 0
}

Write-Host "Found $($backupFiles.Count) backup files to process:" -ForegroundColor Yellow
Write-Host ""

$totalSize = 0
foreach ($file in $backupFiles) {
    $sizeMB = [math]::Round($file.Length / 1MB, 2)
    $totalSize += $sizeMB
    $date = $file.CreationTime.ToString("yyyy-MM-dd HH:mm")
    Write-Host "  $($file.Name) ($sizeMB MB) - Created: $date" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Total space to free: $($totalSize.ToString("F2")) MB" -ForegroundColor Yellow

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run completed. No files were deleted." -ForegroundColor Green
    exit 0
}

# Confirmation
Write-Host ""
$confirmation = Read-Host "Type 'DELETE' to permanently remove these files"
if ($confirmation -ne "DELETE") {
    Write-Host "Cleanup cancelled." -ForegroundColor Yellow
    exit 0
}

# Delete files
Write-Host ""
Write-Host "Deleting old backup files..." -ForegroundColor Yellow

$deletedCount = 0
$errors = 0

foreach ($file in $backupFiles) {
    try {
        Remove-Item -Path $file.FullName -Force
        Write-Host "  Deleted: $($file.Name)" -ForegroundColor Green
        $deletedCount++
    }
    catch {
        Write-Host "  Error deleting: $($file.Name) - $($_.Exception.Message)" -ForegroundColor Red
        $errors++
    }
}

# Log cleanup
$LogEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Cleanup: Removed $deletedCount files, $errors errors, freed $($totalSize.ToString("F2")) MB"
Add-Content -Path (Join-Path $BackupDir "cleanup.log") -Value $LogEntry

Write-Host ""
Write-Host "Cleanup completed!" -ForegroundColor Green
Write-Host "  Files deleted: $deletedCount" -ForegroundColor Cyan
Write-Host "  Errors: $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host "  Space freed: $($totalSize.ToString("F2")) MB" -ForegroundColor Cyan

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
