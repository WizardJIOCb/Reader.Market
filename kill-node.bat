@echo off
echo Killing all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% == 0 (
    echo All Node.js processes terminated successfully.
) else (
    echo No Node.js processes found or already terminated.
)
echo.
echo You can now run start-dev.bat
pause
