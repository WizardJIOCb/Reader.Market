# TTS Engine Setup Guide

This guide explains how to install and configure TTS engines for the reader.market application.

## Prerequisites

Before installing TTS engines, ensure your server meets these requirements:
- Linux-based system (Ubuntu/Debian recommended)
- 64GB RAM (for local TTS processing)
- 12GB GPU (optional, for accelerated processing)
- Node.js and npm
- FFmpeg for audio conversion

## Installation Options

Choose one or both of the following TTS engines:

### Option 1: Install Piper TTS (Recommended)

Piper is a neural text-to-speech system that works well for both English and Russian.

#### 1. Install Dependencies
```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake libespeak-ng-dev libsndfile1-dev jq
```

#### 2. Download and Install Piper
```bash
# Download the latest Piper release
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz
sudo cp piper /usr/local/bin/
sudo chmod +x /usr/local/bin/piper
```

#### 3. Create Models Directory and Download Voice Models
```bash
sudo mkdir -p /opt/piper/models

# Download English voices
wget -O /opt/piper/models/en_US-lessac-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-lessac-medium.onnx"
wget -O /opt/piper/models/en_GB-alan-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_GB-alan-medium.onnx"

# Download Russian voices
wget -O /opt/piper/models/ru_RU-irina-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-irina-medium.onnx"
wget -O /opt/piper/models/ru_RU-dmitri-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-dmitri-medium.onnx"
```

### Option 2: Install RHVoice

RHVoice is excellent for Russian text processing.

#### 1. Install Dependencies
```bash
sudo apt-get install -y build-essential cmake libespeak-ng-dev libsndfile1-dev
```

#### 2. Install RHVoice
```bash
# Install RHVoice packages (Ubuntu/Debian)
sudo apt-get install -y rhvoice rhvoice-data-alexander rhvoice-data-elena rhvoice-data-anna
```

Or build from source:
```bash
git clone https://github.com/RHVoice/RHVoice.git
cd RHVoice
mkdir build && cd build
cmake ..
make
sudo make install
```

## Database Configuration

Run the following SQL to ensure proper TTS configuration in your database:

```sql
INSERT INTO tts_config (
    id,
    tts_enabled,
    enabled_providers,
    default_provider,
    default_lang,
    default_voice_ru,
    default_voice_en,
    default_rate,
    min_rate,
    max_rate,
    chunk_min_chars,
    chunk_max_chars,
    audio_format,
    mp3_bitrate,
    queue_concurrency,
    cache_max_gb,
    cache_ttl_days,
    rhvoice_bin_path,
    piper_bin_path,
    piper_models_dir
) VALUES (
    'default',
    true,
    '["piper", "rhvoice"]',
    'piper',
    'en',
    'ru_RU-irina',
    'en_US-lessac',
    1.00,
    0.80,
    1.25,
    400,
    1800,
    'mp3',
    64,
    1,
    20,
    90,
    '/usr/bin/RHVoice-test',
    '/usr/local/bin/piper',
    '/opt/piper/models'
)
ON CONFLICT (id) DO UPDATE SET
    tts_enabled = EXCLUDED.tts_enabled,
    enabled_providers = EXCLUDED.enabled_providers,
    default_provider = EXCLUDED.default_provider,
    default_lang = EXCLUDED.default_lang,
    default_voice_ru = EXCLUDED.default_voice_ru,
    default_voice_en = EXCLUDED.default_voice_en,
    default_rate = EXCLUDED.default_rate,
    min_rate = EXCLUDED.min_rate,
    max_rate = EXCLUDED.max_rate,
    chunk_min_chars = EXCLUDED.chunk_min_chars,
    chunk_max_chars = EXCLUDED.chunk_max_chars,
    audio_format = EXCLUDED.audio_format,
    mp3_bitrate = EXCLUDED.mp3_bitrate,
    queue_concurrency = EXCLUDED.queue_concurrency,
    cache_max_gb = EXCLUDED.cache_max_gb,
    cache_ttl_days = EXCLUDED.cache_ttl_days,
    rhvoice_bin_path = EXCLUDED.rhvoice_bin_path,
    piper_bin_path = EXCLUDED.piper_bin_path,
    piper_models_dir = EXCLUDED.piper_models_dir;
```

## Docker Configuration (if using Docker)

If you're deploying with Docker, add the following to your Dockerfile:

```dockerfile
# Install TTS engines
RUN apt-get update && \
    apt-get install -y build-essential cmake libespeak-ng-dev libsndfile1-dev jq && \
    # Download and install Piper
    wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz && \
    tar -xzf piper_linux_x86_64.tar.gz && \
    cp piper /usr/local/bin/ && \
    chmod +x /usr/local/bin/piper && \
    # Create models directory
    mkdir -p /opt/piper/models && \
    # Download voice models
    wget -O /opt/piper/models/en_US-lessac-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-lessac-medium.onnx" && \
    wget -O /opt/piper/models/en_GB-alan-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_GB-alan-medium.onnx" && \
    wget -O /opt/piper/models/ru_RU-irina-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-irina-medium.onnx" && \
    wget -O /opt/piper/models/ru_RU-dmitri-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-dmitri-medium.onnx" && \
    # Install RHVoice
    apt-get install -y rhvoice rhvoice-data-alexander rhvoice-data-elena rhvoice-data-anna && \
    # Clean up
    rm piper_linux_x86_64.tar.gz && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

## Verification

After installation, verify that the TTS engines are working:

```bash
# Test Piper
echo "Hello world" | piper --model /opt/piper/models/en_US-lessac-medium.onnx --output_file /tmp/test.wav

# Test RHVoice
echo "Привет мир" | RHVoice-test --voice=alexander --output=/tmp/test.wav
```

## Troubleshooting

1. **"command not found" errors**: Make sure the binary paths in the database match where you installed the engines.

2. **Permission errors**: Ensure the web server process can access the TTS binaries and model files.

3. **Model files not found**: Verify that model files exist in the correct location and have proper permissions.

4. **FFmpeg issues**: Install FFmpeg if you encounter audio conversion errors:
   ```bash
   sudo apt-get install -y ffmpeg
   ```

## Environment Variables

Ensure these environment variables are set in your deployment:

```bash
# TTS Storage Path (for caching generated audio)
TTS_STORAGE_PATH=/var/www/reader.market/storage/tts

# FFmpeg Path (if installed in non-standard location)
FFMPEG_PATH=/usr/bin/ffmpeg
```

## Service Restart

After installation, restart your application server to pick up the new configuration.