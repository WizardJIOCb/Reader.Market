@echo off
setlocal enabledelayedexpansion

set "TARGET_DIR=diff_files"

:: 1. Проверка .gitignore
findstr /C:"%TARGET_DIR%/" .gitignore >nul 2>&1
if %errorlevel% neq 0 (
    echo.>> .gitignore
    echo %TARGET_DIR%/ >> .gitignore
)

:: 2. Пересоздание папки
if exist "%TARGET_DIR%" rd /s /q "%TARGET_DIR%"
mkdir "%TARGET_DIR%"

echo Collecting changes...

:: 3. Основной цикл
for /F "tokens=1*" %%a in ('git status --porcelain ^| findstr /V /C:".local/" /C:".qoder/"') do (
    set "REL_PATH=%%b"
    if "!REL_PATH!"=="" set "REL_PATH=%%a"
    
    :: Убираем возможные кавычки из пути Git
    set "REL_PATH=!REL_PATH:"=!"
    :: Меняем слеши
    set "WIN_PATH=!REL_PATH:/=\!"
    
    if exist "!WIN_PATH!" if not exist "!WIN_PATH!\*" (
        echo Copying: !WIN_PATH!
        
        :: Эмулируем структуру папок через xcopy (это самый простой способ создать дерево для одного файла)
        echo f | xcopy /S /Y /I "!WIN_PATH!" "%TARGET_DIR%\!WIN_PATH!*" >nul 2>&1
    )
)

echo.
echo === Done! ===
pause