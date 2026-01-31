@echo off
set "TARGET_DIR=C:\Changes_Ready"

if exist "%TARGET_DIR%" rd /s /q "%TARGET_DIR%"
mkdir "%TARGET_DIR%"

:: Используем robocopy для каждого файла. 
:: /S не нужен, так как мы копируем конкретный файл в конкретное место.
for /F "tokens=*" %%i in ('git diff --name-only HEAD^ ^| findstr /V /C:".local/" /C:".qoder/"') do (
    echo Copying: %%i
    
    :: robocopy копирует файл, разделяя путь и имя файла. 
    :: %%~dpi - это путь к файлу, %%~nxi - это имя и расширение.
    robocopy "." "%TARGET_DIR%\%%~dpi" "%%~nxi" /NJH /NJS /NDL /NC /NS >nul
)

echo.
echo Готово! Проверьте папку: %TARGET_DIR%
explorer "%TARGET_DIR%"
pause
