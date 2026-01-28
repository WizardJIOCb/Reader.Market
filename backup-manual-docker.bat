@echo off
setlocal

REM Manual Database Backup Script for Windows (Docker Version)
REM This script runs the Docker-based PowerShell backup script in manual mode

echo ========================================
echo Manual Database Backup (Docker Version)
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running or not accessible
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

REM Check if PowerShell script exists
if not exist "%~dp0scripts\backup-database-docker.ps1" (
    echo Error: backup-database-docker.ps1 not found in scripts directory
    echo Please ensure the script exists and try again.
    pause
    exit /b 1
)

REM Run the PowerShell backup script with manual flag
echo Starting backup process using Docker...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\backup-database-docker.ps1" -Manual

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