# TTS Engine Setup for Windows Development

This guide explains how to install and configure TTS engines for local development on Windows.

## Prerequisites

Before installing TTS engines, ensure your system meets these requirements:
- Windows 10 or 11
- Node.js 18+ and npm
- Git Bash or PowerShell
- WSL2 (recommended for better compatibility) or Windows native binaries
- At least 4GB free disk space for voice models

## Installation Options

Choose one or both of the following TTS engines:

### Option 1: Install Piper TTS (Recommended for Windows)

Piper is a neural text-to-speech system that works well for both English and Russian.

#### Method A: Using WSL2 (Recommended)

1. **Install WSL2 with Ubuntu**:
   ```powershell
   # Run in PowerShell as Administrator
   wsl --install Ubuntu
   ```

2. **Open Ubuntu terminal and install Piper**:
   ```bash
   # Update packages
   sudo apt update && sudo apt upgrade -y

   # Install dependencies
   sudo apt install -y build-essential cmake libespeak-ng-dev libsndfile1-dev jq ffmpeg

   # Download and install Piper
   wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
   tar -xzf piper_linux_x86_64.tar.gz
   sudo cp piper /usr/local/bin/
   sudo chmod +x /usr/local/bin/piper

   # Create models directory and download voice models
   sudo mkdir -p /opt/piper/models

   # Download English voices
   wget -O /opt/piper/models/en_US-lessac-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-lessac-medium.onnx"
   wget -O /opt/piper/models/en_GB-alan-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_GB-alan-medium.onnx"

   # Download Russian voices
   wget -O /opt/piper/models/ru_RU-irina-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-irina-medium.onnx"
   wget -O /opt/piper/models/ru_RU-dmitri-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-dmitri-medium.onnx"

   # Clean up
   rm piper_linux_x86_64.tar.gz
   ```

#### Method B: Using Windows Native Binaries (Advanced)

1. **Install Python** (required for some tools):
   - Download from python.org
   - During installation, check "Add Python to PATH"

2. **Install dependencies**:
   ```powershell
   # Install Chocolatey if not already installed
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

   # Install FFmpeg
   choco install ffmpeg
   ```

3. **Build Piper from source** (requires Visual Studio Build Tools):
   ```powershell
   # Install Visual Studio Build Tools
   choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Component.VC.Tools.x86.x64"

   # Clone and build Piper
   git clone https://github.com/rhasspy/piper.git
   cd piper
   # Follow build instructions from Piper documentation
   ```

#### Method C: Use Pre-built Windows Binaries (Easiest)

1. **Download pre-built Piper for Windows**:
   - Visit: https://github.com/rhasspy/piper/releases
   - Download the Windows binary (if available) or use the Python version

2. **Install Python-based Piper**:
   ```powershell
   pip install piper-tts
   ```

### Option 2: Alternative - Use Windows Built-in TTS

If the above options prove difficult, you can temporarily use Windows built-in TTS for development:

1. **Install Windows Powershell TTS**:
   ```powershell
   # Test Windows TTS
   Add-Type -AssemblyName System.Speech
   $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
   $speak.Speak("Hello, this is Windows TTS")
   ```

## Database Configuration for Windows

Run the following script to ensure proper TTS configuration in your database:

```bash
npm run setup-tts
```

Or run the setup script directly:
```bash
node scripts/setup-tts-config.js
```

## Windows-Specific Configuration

Update your `.env` file with Windows-appropriate paths:

```bash
# Database configuration
DATABASE_URL="postgresql://username:password@localhost:5432/reader_market"
POSTGRES_URL="postgresql://username:password@localhost:5432/reader_market"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-here"

# TTS Storage Path (for caching generated audio)
TTS_STORAGE_PATH=./storage/tts

# FFmpeg Path (adjust to your installation)
FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe
```

## Update TTS Service for Windows Paths

If using WSL2, you'll need to adjust the paths in your TTS configuration to use WSL paths. The TTS service will need to call the binaries using `wsl` command prefix.

For Windows native, update the TTS service configuration to point to correct paths.

## Running with start-dev.bat

After installing TTS engines, run your development server:

```powershell
.\start-dev.bat
```

## Verification on Windows

Test that your TTS setup is working:

### For Piper (if installed):
```powershell
# If using WSL
wsl -- bash -c "echo 'Hello world' | piper --model /opt/piper/models/en_US-lessac-medium.onnx --output_file /tmp/test.wav"

# If using Python version
echo "Hello world" | python -m piper --model /path/to/model.onnx --output_file test.wav
```

## Troubleshooting Windows Issues

1. **Path Issues**: Windows uses different path separators. Make sure your configuration uses correct paths.

2. **Permissions**: Run PowerShell as Administrator when installing system-wide packages.

3. **WSL Integration**: If using WSL2, make sure your Node.js development server can call WSL binaries.

4. **Antivirus**: Some antivirus software may block execution of newly downloaded binaries.

## Alternative: Mock TTS Service for Development

If installing TTS engines proves too complex for initial development, you can temporarily mock the TTS service by updating the configuration to disable TTS or use a mock implementation:

```sql
UPDATE tts_config SET 
  tts_enabled = false
WHERE id = 'default';
```

## Environment-Specific Configuration

Consider creating separate configuration for development:

Create `config/tts-config-development.json`:
```json
{
  "piperBinPath": "wsl -e piper",  // For WSL execution
  "rhvoiceBinPath": "C:\\Program Files\\RHVoice\\bin\\RHVoice-test.exe",  // If installed on Windows
  "piperModelsDir": "/opt/piper/models",  // WSL path
  "modelsDir": "./models"  // Local fallback
}
```

Remember to restart your development server after making configuration changes!