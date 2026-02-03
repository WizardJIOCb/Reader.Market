@echo off
echo Setting up TTS configuration for Windows...

REM Run the existing setup script which will work for Windows too
node scripts/setup-tts-config.js

echo TTS configuration setup completed!
echo.
echo To start the development server, run: start-dev.bat
pause