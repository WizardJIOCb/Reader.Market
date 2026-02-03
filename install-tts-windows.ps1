# PowerShell Script for Installing TTS Engines on Windows for reader.market

Write-Host "Setting up TTS engines for reader.market on Windows" -ForegroundColor Green

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Please run this script as Administrator to install system components." -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm is not installed. Please install Node.js which includes npm." -ForegroundColor Red
    exit 1
}

# Check if database is running
try {
    $env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { $env:POSTGRES_URL }
    if (!$env:DATABASE_URL) {
        Write-Host "DATABASE_URL or POSTGRES_URL not set in environment. Please configure your database connection." -ForegroundColor Yellow
        $dbUrl = Read-Host "Enter your database URL (e.g., postgresql://username:password@localhost:5432/database)"
        $env:DATABASE_URL = $dbUrl
    }
} catch {
    Write-Host "Error checking database connection: $_" -ForegroundColor Red
}

Write-Host "`nInstalling Python-based Piper TTS (easiest option for Windows)..." -ForegroundColor Cyan

# Check if Python is installed
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "Python found, installing piper-tts..." -ForegroundColor Green
    python -m pip install piper-tts
    
    # Test the installation
    $testResult = python -c "import piper_tts; print('Piper TTS installed successfully')"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Piper TTS installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to install or test Piper TTS" -ForegroundColor Red
    }
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    Write-Host "Python found (using py launcher), installing piper-tts..." -ForegroundColor Green
    py -m pip install piper-tts
    
    # Test the installation
    $testResult = py -c "import piper_tts; print('Piper TTS installed successfully')"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Piper TTS installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to install or test Piper TTS" -ForegroundColor Red
    }
} else {
    Write-Host "Python not found. You can install it from https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "Alternatively, you can use WSL2 for better compatibility." -ForegroundColor Yellow
}

Write-Host "`nSetting up TTS configuration in database..." -ForegroundColor Cyan

# Run the TTS configuration setup
try {
    npm run setup-tts
    Write-Host "TTS configuration setup completed!" -ForegroundColor Green
} catch {
    Write-Host "TTS configuration setup failed: $_" -ForegroundColor Red
}

Write-Host "`nChecking if FFmpeg is installed..." -ForegroundColor Cyan

# Check if FFmpeg is installed
if (!(Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "FFmpeg not found. Installing via Chocolatey..." -ForegroundColor Yellow
    
    # Check if Chocolatey is installed
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Host "Chocolatey not found. Installing Chocolatey first..." -ForegroundColor Yellow
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    }
    
    # Install FFmpeg
    choco install ffmpeg -y
} else {
    Write-Host "FFmpeg is already installed." -ForegroundColor Green
}

Write-Host "`nTTS setup for Windows is complete!" -ForegroundColor Green
Write-Host "To start your development server, run: .\start-dev.bat" -ForegroundColor Green
Write-Host "`nNote: For best results, consider using WSL2 with Ubuntu for development." -ForegroundColor Yellow
Write-Host "See WINDOWS_TTS_SETUP.md for alternative installation methods." -ForegroundColor Yellow