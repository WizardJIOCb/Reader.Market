@echo off
SETLOCAL

echo Stopping Ollama Reader development processes...

REM Kill backend processes (port 5001)
echo Stopping backend server...
taskkill /f /im node.exe /fi "WINDOWTITLE eq Backend*" >nul 2>&1

REM Kill frontend processes (port 3001)
echo Stopping frontend server...
taskkill /f /im node.exe /fi "WINDOWTITLE eq Frontend*" >nul 2>&1

REM Kill any remaining Node.js processes that might be related to our app
echo Cleaning up any remaining Node.js processes...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do (
    taskkill /f /pid %%i >nul 2>&1
)
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /f /pid %%i >nul 2>&1
)

REM Stop Docker container
echo Stopping PostgreSQL container...
docker stop postgres-db >nul 2>&1

REM Kill all node processes as a last resort
echo Killing all Node.js processes as a last resort...
taskkill /f /im node.exe >nul 2>&1

echo.
echo ================================
echo DEVELOPMENT PROCESSES STOPPED
echo ================================
echo All backend and frontend processes have been terminated.
echo PostgreSQL container has been stopped.
echo You can now safely run start-dev.bat again.
echo ================================
pause