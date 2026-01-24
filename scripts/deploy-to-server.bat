@echo off
REM Deployment script for reader.market on Windows

set SERVER=82.146.42.213
set PROJECT_PATH=/var/www/reader.market

echo Starting deployment to %SERVER%...

REM 1. Commit local changes
echo Committing local changes...
git add .
git commit -m "Deployment commit %date% %time%" || echo No changes to commit

REM 2. Push to remote
echo Pushing to remote...
git push origin main

REM 3. Use PowerShell to handle SSH deployment
powershell -Command ^
"$session = New-SSHSession -ComputerName '%SERVER%' -Credential (Get-Credential) -Force; "^
"Invoke-SSHCommand -SSHSession $session -Command 'cd %PROJECT_PATH%; git stash; git pull; git stash pop'; "^
"Remove-SSHSession -SSHSession $session"

echo Deployment completed!
pause