# Safe Mode Database Restore Script
# Extra protection against accidental execution
# Usage: .\scripts\restore-safemode.ps1

param(
    [string]$BackupFile = "",
    [switch]$Force = $false
)

# Extra safety check - only run if explicitly called with safemode
if (!$Force) {
    Write-Host "⚠️  SAFE MODE ACTIVATED ⚠️" -ForegroundColor Red
    Write-Host "==========================" -ForegroundColor Red
    Write-Host "This is the SAFE MODE restore script." -ForegroundColor Yellow
    Write-Host "To proceed, you must:" -ForegroundColor Yellow
    Write-Host "1. Use the -Force parameter" -ForegroundColor Gray
    Write-Host "2. Or use the regular restore script instead" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Usage: .\scripts\restore-safemode.ps1 -Force" -ForegroundColor Cyan
    Write-Host "Or use: .\scripts\restore-database.ps1" -ForegroundColor Cyan
    exit 1
}

# If forced, delegate to regular restore script with additional warnings
Write-Host "⚠️  FORCED RESTORE MODE ⚠️" -ForegroundColor Red
Write-Host "=========================" -ForegroundColor Red
Write-Host "You have bypassed safemode protections!" -ForegroundColor Red
Write-Host "Extra confirmation required..." -ForegroundColor Yellow
Write-Host ""

# Additional time delay for reflection
Write-Host "Pausing for 10 seconds to reconsider..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to cancel NOW" -ForegroundColor Red
Start-Sleep -Seconds 10

# Pass through to regular restore script
$scriptPath = Join-Path $PSScriptRoot "restore-database.ps1"
& $scriptPath -BackupFile $BackupFile