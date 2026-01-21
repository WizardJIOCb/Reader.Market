@echo off
SETLOCAL

echo ========================================
echo Running Database Migrations (DEV)
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

REM Start Docker PostgreSQL container if not running
echo Checking PostgreSQL Docker container...
docker start postgres-db >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Creating and starting PostgreSQL container...
    docker run --name postgres-db -e POSTGRES_USER=booksuser -e POSTGRES_PASSWORD=bookspassword -e POSTGRES_DB=booksdb -p 5432:5432 -d postgres:15
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to start PostgreSQL container. Please check Docker.
        pause
        exit /b 1
    )
    echo Waiting for PostgreSQL to initialize...
    timeout /t 5 /nobreak >nul
)

REM Test database connection
echo Testing database connection...
node scripts/db_test.js
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Database connection failed.
    echo Waiting 5 seconds and retrying...
    timeout /t 5 /nobreak >nul
    node scripts/db_test.js
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Database still not accessible.
        pause
        exit /b 1
    )
)

echo Database connected successfully.
echo.

REM Run the migration script
echo Running migrations from migrations/custom folder...
node scripts/run-migrations.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Migration failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Migrations completed successfully!
echo ========================================
pause
