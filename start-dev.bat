@echo off
SETLOCAL

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
    echo Waiting for PostgreSQL to initialize...
    timeout /t 10 /nobreak >nul
)

REM Start Ollama service
echo Starting Ollama service in background...
start "Ollama" /MIN cmd /c "ollama serve"

timeout /t 5 /nobreak >nul

REM Start backend server on port 5001
echo Starting backend server on port 5001...
start "Backend" cmd /k "set PORT=5001 && node dist/index.cjs || npm run dev"

timeout /t 5 /nobreak >nul

REM Start frontend server on port 3001
echo Starting frontend server on port 3001...
start "Frontend" cmd /k "npm run dev:client"

echo.
echo ================================
echo DEVELOPMENT SERVERS STARTED
echo ================================
echo Backend:  http://localhost:5001
echo Frontend: http://localhost:3001
echo.
echo Press any key to close this window.
echo Use stop-dev.bat to properly stop all services.
echo ================================
pause