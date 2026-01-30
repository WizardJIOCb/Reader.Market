@echo off
setlocal enabledelayedexpansion

:: Script to copy only source code files while preserving folder structure
:: Excludes backups, images, node_modules, and other non-source files

set SOURCE_DIR=%~dp0
set TARGET_DIR=%SOURCE_DIR%shared\sources-for-tasks

echo Creating clean source code copy...
echo Source: %SOURCE_DIR%
echo Target: %TARGET_DIR%

:: Remove existing target directory
if exist "%TARGET_DIR%" (
    echo Removing existing target directory...
    rd /s /q "%TARGET_DIR%"
)

:: Create target directory
mkdir "%TARGET_DIR%"

:: Copy files with exclusions
echo Copying files (excluding non-source content)...

robocopy "%SOURCE_DIR%" "%TARGET_DIR%" /E ^
    /XD node_modules .git .vscode .next dist build coverage tmp temp logs backups screenshots uploads ^
    /XF *.jpg *.jpeg *.png *.gif *.webp *.ico *.svg *.bmp *.tiff *.mp4 *.avi *.mov *.wmv *.mp3 *.wav *.ogg *.pdf *.doc *.docx *.xls *.xlsx *.zip *.rar *.7z *.tar *.gz *.log *.lock *.sqlite *.db *.env *.env.local *.env.production ^
    /XD __pycache__ .pytest_cache .coverage .DS_Store Thumbs.db *.tmp *.temp

:: Additional cleanup - remove specific file types that might have slipped through
echo Cleaning up additional non-source files...

:: Remove image files from copied directory
del /s /q "%TARGET_DIR%\*.jpg" >nul 2>&1
del /s /q "%TARGET_DIR%\*.jpeg" >nul 2>&1
del /s /q "%TARGET_DIR%\*.png" >nul 2>&1
del /s /q "%TARGET_DIR%\*.gif" >nul 2>&1
del /s /q "%TARGET_DIR%\*.webp" >nul 2>&1
del /s /q "%TARGET_DIR%\*.ico" >nul 2>&1
del /s /q "%TARGET_DIR%\*.svg" >nul 2>&1
del /s /q "%TARGET_DIR%\*.bmp" >nul 2>&1
del /s /q "%TARGET_DIR%\*.tiff" >nul 2>&1

:: Remove media files
del /s /q "%TARGET_DIR%\*.mp4" >nul 2>&1
del /s /q "%TARGET_DIR%\*.avi" >nul 2>&1
del /s /q "%TARGET_DIR%\*.mov" >nul 2>&1
del /s /q "%TARGET_DIR%\*.wmv" >nul 2>&1
del /s /q "%TARGET_DIR%\*.mp3" >nul 2>&1
del /s /q "%TARGET_DIR%\*.wav" >nul 2>&1
del /s /q "%TARGET_DIR%\*.ogg" >nul 2>&1

:: Remove document and archive files
del /s /q "%TARGET_DIR%\*.pdf" >nul 2>&1
del /s /q "%TARGET_DIR%\*.doc" >nul 2>&1
del /s /q "%TARGET_DIR%\*.docx" >nul 2>&1
del /s /q "%TARGET_DIR%\*.xls" >nul 2>&1
del /s /q "%TARGET_DIR%\*.xlsx" >nul 2>&1
del /s /q "%TARGET_DIR%\*.zip" >nul 2>&1
del /s /q "%TARGET_DIR%\*.rar" >nul 2>&1
del /s /q "%TARGET_DIR%\*.7z" >nul 2>&1
del /s /q "%TARGET_DIR%\*.tar" >nul 2>&1
del /s /q "%TARGET_DIR%\*.gz" >nul 2>&1

:: Remove log and database files
del /s /q "%TARGET_DIR%\*.log" >nul 2>&1
del /s /q "%TARGET_DIR%\*.lock" >nul 2>&1
del /s /q "%TARGET_DIR%\*.sqlite" >nul 2>&1
del /s /q "%TARGET_DIR%\*.db" >nul 2>&1

:: Remove environment files
del /s /q "%TARGET_DIR%\*.env" >nul 2>&1
del /s /q "%TARGET_DIR%\*.env.local" >nul 2>&1
del /s /q "%TARGET_DIR%\*.env.production" >nul 2>&1

:: Remove cache and temporary directories
for /d /r "%TARGET_DIR%" %%i in (__pycache__) do if exist "%%i" rd /s /q "%%i"
for /d /r "%TARGET_DIR%" %%i in (.pytest_cache) do if exist "%%i" rd /s /q "%%i"
for /d /r "%TARGET_DIR%" %%i in (.coverage) do if exist "%%i" rd /s /q "%%i"
for /d /r "%TARGET_DIR%" %%i in (.DS_Store) do if exist "%%i" rd /s /q "%%i"

echo.
echo Source code copy completed!
echo Location: %TARGET_DIR%
echo.
echo Included file types:
echo - Source code (.ts, .tsx, .js, .jsx, .css, .scss, .html, .json, etc.)
echo - Configuration files (.config, .rc, package.json, tsconfig.json, etc.)
echo - Documentation (.md, .txt)
echo - Script files (.sh, .bat, .ps1)
echo.
echo Excluded file types:
echo - Images (.jpg, .png, .gif, .svg, etc.)
echo - Media files (.mp4, .mp3, .avi, etc.)
echo - Documents (.pdf, .docx, .xlsx, etc.)
echo - Archives (.zip, .rar, .7z, etc.)
echo - Logs and databases (.log, .sqlite, .db)
echo - Environment files (.env, .env.local)
echo - Cache and temporary files
echo - node_modules directories
echo.
pause