@echo off
setlocal

REM Manual Database Backup Script for Windows
REM This script runs the PowerShell backup script in manual mode

echo ========================================
echo Manual Database Backup
echo ========================================
echo.

REM Check if PowerShell script exists
if not exist "%~dp0scripts\backup-database.ps1" (
    echo Error: backup-database.ps1 not found in scripts directory
    echo Please ensure the script exists and try again.
    pause
    exit /b 1
)

REM Run the PowerShell backup script with manual flag
echo Starting backup process...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\backup-database.ps1" -Manual

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Backup completed successfully!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Backup failed with error code: %errorlevel%
    echo ========================================
)

echo.
pause