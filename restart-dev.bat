@echo off

echo ========================================
echo RESTARTING DEVELOPMENT ENVIRONMENT
echo ========================================

echo Stopping all development processes...
call stop-dev.bat

echo.
echo Starting development environment with fresh build...
call start-dev.bat

echo.
echo ========================================
echo DEVELOPMENT ENVIRONMENT RESTARTED
echo ========================================
