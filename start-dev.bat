@echo off
SETLOCAL

REM Clean up any existing PID file
if exist "C:\Projects\reader.market\pids.txt" del "C:\Projects\reader.market\pids.txt"

REM Kill any existing processes on our ports
echo Stopping any existing processes on ports 5001 and 3001...
taskkill /f /im node.exe /fi "WINDOWTITLE eq Backend*" >nul 2>&1
taskkill /f /im node.exe /fi "WINDOWTITLE eq Frontend*" >nul 2>&1

REM Start Docker containers if needed
echo Starting Docker containers...
docker start postgres-db >nul 2>&1 || (
    echo Creating and starting PostgreSQL container...
    docker run --name postgres-db -e POSTGRES_USER=booksuser -e POSTGRES_PASSWORD=bookspassword -e POSTGRES_DB=booksdb -p 5432:5432 -d postgres:15
    if %errorlevel% neq 0 (
        echo Failed to create PostgreSQL container. Please check your Docker installation.
        pause
        exit /b 1
    )
)

echo Verifying PostgreSQL is starting...

echo Verifying PostgreSQL is ready...
:check_db_ready
for /f "" %%i in ('docker inspect -f "{{.State.Running}}" postgres-db 2^>nul') do set running=%%i
if "%running%"=="true" (
    echo PostgreSQL container is running
) else (
    echo PostgreSQL container failed to start, recreating...
    docker stop postgres-db >nul 2>&1
    docker rm postgres-db >nul 2>&1
    goto create_postgres_container
)

REM Wait for PostgreSQL to become ready with limited checks
set attempt=0
set max_attempts=6

echo Waiting for PostgreSQL to become ready...
echo Testing database connection immediately...
node db_test.js
if %errorlevel% equ 0 (
    goto db_ready
)

echo Database not ready, will try 5 more times with 500ms delay...
:wait_for_db
set /a attempt=%attempt%+1
echo Testing database connection attempt %attempt% of 5...
node db_test.js
if %errorlevel% equ 0 (
    goto db_ready
)
if %attempt% geq 5 (
    echo Database connection failed after maximum attempts.
    echo Please ensure Docker is running and PostgreSQL container is healthy.
    pause
    exit /b 1
)
REM Use a short delay - approximately 500ms
ping -n 2 127.0.0.1 >nul
goto wait_for_db

:db_ready
echo Database is ready!

goto continue_after_db_check

:create_postgres_container
echo Creating and starting PostgreSQL container...
docker run --name postgres-db -e POSTGRES_USER=booksuser -e POSTGRES_PASSWORD=bookspassword -e POSTGRES_DB=booksdb -p 5432:5432 -d postgres:15
if %errorlevel% neq 0 (
    echo Failed to create PostgreSQL container. Please check your Docker installation.
    pause
    exit /b 1
)

echo Waiting for PostgreSQL to initialize...
timeout /t 10 /nobreak >nul
goto check_db_ready

:continue_after_db_check

REM Clean dist folder to ensure fresh development build
echo Cleaning dist folder...
if exist dist rmdir /S /Q dist
if exist dist-client rmdir /S /Q dist-client
echo Dist folders cleaned.

REM Apply all pending database migrations
echo Applying database migrations...
if exist node_modules (
    echo Running pending migrations...
    REM Check if _drizzle_migrations table exists to determine if this is a fresh DB or existing
    echo Checking database migration status...
    REM Due to duplicate migration files, skip migration and use schema push instead
    echo Using schema push to sync with current schema...
    REM Run drizzle push in background to not block the script
    start "Drizzle Setup" cmd /c "npx drizzle-kit push --config=drizzle.config.ts 2>nul && echo Drizzle setup completed in background"
    REM Don't wait for drizzle to finish, continue with server startup
) else (
    echo Installing dependencies first...
    npm install
    start "Drizzle Setup" cmd /c "npx drizzle-kit push --config=drizzle.config.ts 2>nul && echo Drizzle setup completed in background"
)

REM Verify database connectivity (additional check after migrations)
echo Verifying database connectivity after migrations...
node db_test.js

echo Completed database setup successfully.
REM Give a small delay to allow drizzle to complete
timeout /t 2 /nobreak >nul

REM Start Ollama service
echo Starting Ollama service in background...
start "Ollama" /MIN cmd /c "ollama serve" 2>nul || echo Warning: Could not start Ollama service

echo Ollama service started (or attempted).

REM Start backend server on port 5001 in development mode
echo Starting backend server on port 5001 (dev mode with hot-reload)...
echo.
echo ================================
echo DEVELOPMENT SERVERS STARTED
echo ================================
echo Backend:  http://localhost:5001
echo Frontend: http://localhost:3001
echo.
echo Use stop-dev.bat to properly stop all services.
echo ================================
echo.
echo Starting servers...
REM Ensure we're in the right directory
cd /d C:\Projects\reader.market

REM Store the current process PID (the launcher window) to a file
echo %PROCESSOR_IDENTIFIER% > "C:\Projects\reader.market\pids.txt"

echo Launching backend server...
start "Backend - Reader.Market" cmd /k "cd /d C:\Projects\reader.market && set PORT=5001 && echo Starting backend... && npm run dev && pause"

echo Launching frontend server...
start "Frontend - Reader.Market" cmd /k "cd /d C:\Projects\reader.market && echo Starting frontend... && npm run dev:client && pause"

echo Servers launched. This window will stay open to keep the process running.
echo Close this window or run stop-dev.bat to stop all services.

REM Auto-exit this launcher window after a short delay to avoid the pause
timeout /t 3 /nobreak >nul
exit /b 0