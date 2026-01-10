@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

echo Stopping Ollama Reader development processes...

REM Kill Ollama processes
echo Stopping Ollama service...
taskkill /f /im ollama.exe /fi "WINDOWTITLE eq Ollama*" >nul 2>&1
taskkill /f /im ollama.exe >nul 2>&1

REM Kill backend processes (port 5001) - more specific targeting
echo Stopping backend server...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do (
    taskkill /f /pid %%i >nul 2>&1
)

REM Kill frontend processes (port 3001) - more specific targeting  
echo Stopping frontend server...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /f /pid %%i >nul 2>&1
)

REM More specific targeting of backend/frontend processes by command line
echo Cleaning up any remaining Node.js processes...
for /f "skip=1 tokens=2" %%i in ('wmic process where "CommandLine LIKE '%%npm run dev%%' AND CommandLine LIKE '%%Backend%%Reader.Market%%'" get ProcessId') do (
    if not "%%i"=="" taskkill /f /pid %%i >nul 2>&1
)

for /f "skip=1 tokens=2" %%i in ('wmic process where "CommandLine LIKE '%%npm run dev:client%%' AND CommandLine LIKE '%%Frontend%%Reader.Market%%'" get ProcessId') do (
    if not "%%i"=="" taskkill /f /pid %%i >nul 2>&1
)

for /f "skip=1 tokens=2" %%i in ('wmic process where "CommandLine LIKE '%%ollama serve%%'" get ProcessId') do (
    if not "%%i"=="" taskkill /f /pid %%i >nul 2>&1
)

REM Stop Docker container
echo Stopping PostgreSQL container...
docker stop postgres-db >nul 2>&1

REM Kill any remaining processes by window title as final step
echo Closing related console windows...
taskkill /f /fi "WINDOWTITLE eq *Backend - Reader.Market*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq *Frontend - Reader.Market*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq *Ollama*" >nul 2>&1

REM Final force kill of any remaining development-related processes
taskkill /f /im node.exe /fi "MODULES eq *vite*" >nul 2>&1
taskkill /f /im node.exe /fi "MODULES eq *tsx*" >nul 2>&1

REM Clean both dist and dist-client folders to ensure fresh start
echo Cleaning dist folders...
if exist dist rmdir /S /Q dist
if exist dist-client rmdir /S /Q dist-client
echo Dist folders cleaned.

echo.
echo ================================
echo DEVELOPMENT PROCESSES STOPPED
echo ================================
echo All backend, frontend, and Ollama processes have been terminated.
echo PostgreSQL container has been stopped.
echo Both dist and dist-client folders have been cleaned.
echo You can now safely run start-dev.bat again.
echo ================================

REM Extra aggressive window closing for any remaining processes - at the very end
echo Performing final aggressive cleanup...

REM Use PowerShell to find all processes related to our project and terminate them
powershell -Command "Get-WmiObject Win32_Process | Where-Object {((($_.CommandLine -like '*start-dev*') -and ($_.CommandLine -notlike '*restart-dev*')) -or (($_.CommandLine -like '*C:\\Projects\\reader.market*') -and ($_.CommandLine -notlike '*restart-dev*')) -or (($_.CommandLine -like '*Reader.Market*') -and ($_.CommandLine -notlike '*restart-dev*'))) } | ForEach-Object {try {Stop-Process $_.ProcessId -Force -ErrorAction SilentlyContinue} catch {}}"

REM Use PowerShell to find and terminate cmd processes with specific directory in their working directory
powershell -Command "Get-WmiObject Win32_Process | Where-Object {($_.Name -eq 'cmd.exe') -and ((($_.CommandLine -like '*C:\\Projects\\reader.market*') -and ($_.CommandLine -notlike '*restart-dev*')) -or (($_.ExecutablePath -like '*reader.market*') -and ($_.ExecutablePath -notlike '*restart-dev*'))) } | ForEach-Object {try {Stop-Process $_.ProcessId -Force -ErrorAction SilentlyContinue} catch {}}"

REM Create a temporary VBS script to send a keypress to any remaining console window
echo Set objShell = CreateObject("WScript.Shell") > "%temp%\sendkey.vbs"
echo WScript.Sleep 1000 >> "%temp%\sendkey.vbs"
echo objShell.SendKeys "{ENTER}" >> "%temp%\sendkey.vbs"

REM Run the VBS script to send an ENTER keypress (this might help with the pause command)
cscript //nologo "%temp%\sendkey.vbs" >nul 2>&1

REM Delete the temporary VBS script
if exist "%temp%\sendkey.vbs" del "%temp%\sendkey.vbs" >nul 2>&1

REM Final aggressive cleanup: Kill any remaining cmd.exe processes that might be related to our project
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq cmd.exe" /fo csv ^| findstr /i cmd') do (
    REM Try to identify and kill only the launcher window by looking for specific characteristics
    taskkill /f /pid %%i >nul 2>&1
)

REM Final fallback: Force terminate any remaining cmd windows with specific titles
taskkill /f /fi "WINDOWTITLE eq *Backend - Reader.Market*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq *Frontend - Reader.Market*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq *Ollama*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq *start-dev.bat*" >nul 2>&1
REM taskkill /f /fi "WINDOWTITLE eq *Command Prompt*" >nul 2>&1 REM Commented out to prevent killing the calling script
REM taskkill /f /fi "WINDOWTITLE eq *C:\\Projects\\reader.market*" >nul 2>&1 REM Commented out to prevent killing the calling script
REM taskkill /f /fi "WINDOWTITLE eq *reader.market*" >nul 2>&1 REM Commented out to prevent killing the calling script
