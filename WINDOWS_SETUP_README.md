# Windows TTS Setup Instructions

This document explains how to set up TTS engines for development on Windows.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Python 3.8+ installed (for Python-based TTS)
- Git for Windows

## Option 1: Install Piper TTS (Advanced - Requires Additional Dependencies)

### Step 1: Install Python-based Piper TTS

Open Command Prompt or PowerShell as Administrator and run:

```bash
pip install piper-tts
```

Or if you have multiple Python versions:

```bash
py -m pip install piper-tts
```

### Step 2: Install Additional Dependencies for Windows

For Russian language support on Windows, install additional dependencies:

```bash
pip install espeak-phonemizer
```

### Step 3: Install FFmpeg

Install FFmpeg for audio processing:

Using Chocolatey (recommended):
```powershell
choco install ffmpeg
```

Or download from: https://www.gyan.dev/ffmpeg/builds/

## Option 2: Install RHVoice (Recommended for Windows)

### Step 1: Download and Install RHVoice

1. Go to https://github.com/RHVoice/RHVoice/releases
2. Download the latest Windows installer (e.g., `RHVoice-x.x.x-win64.exe`)
3. Run the installer as Administrator
4. Install to the default location: `C:\Program Files\RHVoice\`

### Step 2: Install Russian Voices for RHVoice

1. Download Russian voice packs from the RHVoice releases page
2. Install voice packs (e.g., Anna, Elena, Aleksey voices)
3. Voices are typically installed to `C:\Program Files\RHVoice\sdk\bin\voices\`

### Step 3: Verify Installation

Open Command Prompt and run:
```
"C:\Program Files\RHVoice\bin\RHVoice-test.exe" --version
```

## Step 4: Run Database Migrations

The TTS configuration will be set up automatically when you run the database migrations. Simply run:

```bash
npm run db:push
```

This will create the necessary tables and configuration records in your database.

## Step 5: Configure Environment Variables

Create a `.env` file in the project root with your database connection:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/your_database_name
POSTGRES_URL=postgresql://username:password@localhost:5432/your_database_name
JWT_SECRET=your_super_secret_jwt_key
TTS_STORAGE_PATH=./storage/tts
FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe  # Adjust path if installed elsewhere
```

## Step 6: Update TTS Configuration (Required)

Run the following command to update the TTS configuration with proper binary paths:

```bash
npm run update-tts-config
```

This will update the database with the correct paths for the TTS engines.

## Step 7: Download TTS Voice Models (For Piper)

If using Piper TTS, download the required voice models for the TTS engines:

```bash
npm run download-tts-models
```

This will download the necessary voice model files to `C:\opt\piper\models`.

## Step 8: Start Development Server

```bash
.\start-dev.bat
```

## Alternative: Using WSL2 (Recommended for Advanced Users)

For better compatibility, consider using Windows Subsystem for Linux:

1. Install WSL2 with Ubuntu
2. Install Node.js, PostgreSQL, and TTS engines inside WSL2
3. Access your project files from the WSL filesystem

## Troubleshooting

### If piper command is not recognized:
- Make sure Python is in your PATH
- Try running `python -m piper` instead of just `piper`
- Reinstall piper-tts package

### If RHVoice is not working:
- Verify RHVoice is installed at `C:\Program Files\RHVoice\`
- Check that the binary path exists: `C:\Program Files\RHVoice\bin\RHVoice-test.exe`
- Run the binary directly from Command Prompt to test

### If Piper TTS fails with espeakbridge error on Windows:
- Windows has limited support for some TTS engines
- Try installing additional dependencies: `pip install espeak-phonemizer`
- For Russian language support, you may need to install additional language packs
- Consider using alternative TTS providers if issues persist

### Database Connection Issues:
- Verify your PostgreSQL server is running
- Check your connection string in the .env file
- Make sure the database exists

### Audio Processing Issues:
- Ensure FFmpeg is properly installed and in your PATH
- Check that the TTS storage directory exists and is writable

## Verification

Once everything is set up, you can test the TTS functionality in the Reader interface. Look for the "Playback" panel and try the text-to-speech feature.