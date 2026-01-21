@echo off
SETLOCAL

echo ================================
echo HTTPS DEVELOPMENT SERVER
echo For VK ID OAuth Testing
echo ================================

REM Change to project directory first (admin starts in system32)
cd /d C:\Projects\reader.market

REM Check if running as admin (required for port 443)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script requires Administrator privileges for port 443.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Kill any existing processes on port 443
echo Stopping any existing processes on port 443...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :443 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

REM Start Docker containers if needed
echo Starting Docker containers...
docker start postgres-db >nul 2>&1 || (
    echo PostgreSQL container not found. Please run start-dev.bat first to set up the database.
    pause
    exit /b 1
)

REM Wait for PostgreSQL to be ready
echo Verifying database connection...
node scripts/db_test.js
if %errorlevel% neq 0 (
    echo Database connection failed. Please ensure PostgreSQL is running.
    pause
    exit /b 1
)

echo Database is ready!

REM Ensure we're in the right directory
cd /d C:\Projects\reader.market

echo.
echo ================================
echo HTTPS SERVER STARTING
echo ================================
echo URL: https://localhost
echo Port: 443 (HTTPS)
echo.
echo VK ID OAuth redirect: https://localhost/auth/callback/vk
echo.
echo Press Ctrl+C to stop the server.
echo ================================
echo.

REM Start the server with HTTPS on port 443
set USE_HTTPS=true
set PORT=443
set APP_URL=https://localhost
npm run dev
