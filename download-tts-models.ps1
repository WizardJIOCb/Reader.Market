# PowerShell script to download TTS voice models for Piper

Write-Host "Downloading TTS voice models for Piper..." -ForegroundColor Green

# Create models directory if it doesn't exist
$modelsDir = "C:\opt\piper\models"
if (!(Test-Path $modelsDir)) {
    Write-Host "Creating models directory: $modelsDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $modelsDir -Force
}

# Download model files
$downloads = @(
    @{ Url = "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-lessac-medium.onnx"; File = "$modelsDir\en_US-lessac-medium.onnx" },
    @{ Url = "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-irina-medium.onnx"; File = "$modelsDir\ru_RU-irina-medium.onnx" }
)

foreach ($dl in $downloads) {
    if (Test-Path $dl.File) {
        Write-Host "Skipping $($dl.File) (already exists)" -ForegroundColor Cyan
    } else {
        Write-Host "Downloading $($dl.File)..." -ForegroundColor White
        Invoke-WebRequest -Uri $dl.Url -OutFile $dl.File
        Write-Host "✓ Downloaded $($dl.File)" -ForegroundColor Green
    }
}

Write-Host "`nTTS voice models download completed!" -ForegroundColor Green
Write-Host "Models are stored in: $modelsDir" -ForegroundColor Yellow

# Verify downloads
Write-Host "`nVerifying downloaded models..." -ForegroundColor Cyan
Get-ChildItem -Path $modelsDir -Filter "*.onnx" | ForEach-Object {
    Write-Host "  ✓ $($_.Name) - $([math]::Round($_.Length / 1MB, 2)) MB" -ForegroundColor Green
}

Write-Host "`nYou can now use TTS functionality in the application!" -ForegroundColor Green