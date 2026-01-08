@echo off
echo Stopping Node.js processes...
taskkill /F /IM node.exe 2>nul
if errorlevel 1 (
    echo No Node.js processes found
) else (
    echo Node.js processes stopped
)
timeout /t 2 /nobreak >nul
echo.
echo Starting dev server...
cd /d C:\Projects\reader.market
npm run dev
