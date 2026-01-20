@echo off
REM Migration runner for reader.market database
REM Uses Node.js to run SQL migrations

echo ========================================
echo Running Database Migrations
echo ========================================
echo.

REM Check if Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found. Please install Node.js.
    echo.
    pause
    exit /b 1
)

REM Run the migration script
node scripts/run-migrations.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Migration failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
pause
