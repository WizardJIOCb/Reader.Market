@echo off
setlocal

REM Database Restore Script for Windows (Docker Version)
REM This script runs the Docker-based PowerShell restore script

echo ========================================
echo Database Restore (Docker Version)
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
if not exist "%~dp0scripts\restore-database-docker.ps1" (
    echo Error: restore-database-docker.ps1 not found in scripts directory
    echo Please ensure the script exists and try again.
    pause
    exit /b 1
)

REM Run the PowerShell restore script
echo Starting restore process using Docker...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\restore-database-docker.ps1"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Restore completed successfully!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Restore failed with error code: %errorlevel%
    echo ========================================
)

echo.
pause