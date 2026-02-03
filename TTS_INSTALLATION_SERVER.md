# TTS Engine Installation for Server Deployment

This document explains how to properly install and configure TTS engines when deploying the reader.market application to a server.

## Server Requirements

Before installation, ensure your server meets these requirements:
- Linux-based system (Ubuntu 20.04 LTS or newer recommended)
- PostgreSQL database (12 or newer)
- Node.js 18+ and npm/yarn
- At least 4GB free disk space for voice models
- FFmpeg for audio processing

## Installation Steps

### 1. Clone and Build the Application

```bash
# Clone the repository
git clone <your-repo-url>
cd reader.market

# Install dependencies
npm install

# Build the application
npm run build
```

### 2. Set Up Environment Variables

Create a `.env` file with your database and other configuration:

```bash
# Database configuration
DATABASE_URL="postgresql://username:password@localhost:5432/reader_market"
POSTGRES_URL="postgresql://username:password@localhost:5432/reader_market"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-here"

# TTS Storage Path (for caching generated audio)
TTS_STORAGE_PATH="/var/www/reader.market/storage/tts"

# FFmpeg Path (usually /usr/bin/ffmpeg on most systems)
FFMPEG_PATH="/usr/bin/ffmpeg"
```

### 3. Install TTS Engines

Choose one or both of the following options:

#### Option A: Install Both Piper and RHVoice (Recommended)

```bash
# Update system packages
sudo apt-get update

# Install build dependencies
sudo apt-get install -y build-essential cmake libespeak-ng-dev libsndfile1-dev jq ffmpeg

# Install RHVoice
sudo apt-get install -y rhvoice rhvoice-data-alexander rhvoice-data-elena rhvoice-data-anna

# Download and install Piper
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz
sudo cp piper /usr/local/bin/
sudo chmod +x /usr/local/bin/piper

# Create models directory and download voice models
sudo mkdir -p /opt/piper/models

# Download English voices
sudo wget -O /opt/piper/models/en_US-lessac-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-lessac-medium.onnx"
sudo wget -O /opt/piper/models/en_GB-alan-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_GB-alan-medium.onnx"

# Download Russian voices
sudo wget -O /opt/piper/models/ru_RU-irina-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-irina-medium.onnx"
sudo wget -O /opt/piper/models/ru_RU-dmitri-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-dmitri-medium.onnx"

# Clean up installation files
rm piper_linux_x86_64.tar.gz
```

#### Option B: Install Only Piper (Lighter Option)

```bash
# Update system packages
sudo apt-get update

# Install dependencies
sudo apt-get install -y build-essential libespeak-ng-dev libsndfile1-dev jq ffmpeg

# Download and install Piper
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz
sudo cp piper /usr/local/bin/
sudo chmod +x /usr/local/bin/piper

# Create models directory and download voice models
sudo mkdir -p /opt/piper/models

# Download English voices
sudo wget -O /opt/piper/models/en_US-lessac-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-lessac-medium.onnx"

# Download Russian voices
sudo wget -O /opt/piper/models/ru_RU-irina-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-irina-medium.onnx"

# Clean up installation files
rm piper_linux_x86_64.tar.gz
```

### 4. Verify TTS Installation

Test that the TTS engines are working:

```bash
# Test Piper
echo "Hello world" | piper --model /opt/piper/models/en_US-lessac-medium.onnx --output_file /tmp/test.wav && echo "Piper OK"

# Test RHVoice (if installed)
echo "Привет мир" | RHVoice-test --voice=alexander --output=/tmp/test_rhvoice.wav && echo "RHVoice OK"
```

### 5. Set Up Directories and Permissions

```bash
# Create TTS storage directory
sudo mkdir -p /var/www/reader.market/storage/tts
sudo chown -R www-data:www-data /var/www/reader.market/storage/tts
sudo chmod -R 755 /var/www/reader.market/storage/tts

# Ensure your application has permission to execute TTS binaries
ls -la /usr/local/bin/piper
ls -la /usr/bin/RHVoice-test  # if installed
```

### 6. Run TTS Configuration Setup

Run the TTS configuration setup to ensure the database has proper TTS settings:

```bash
npm run setup-tts
```

### 7. Run Database Migrations

Make sure all database migrations are applied:

```bash
npm run db:push
```

### 8. Start the Application

```bash
npm start
```

Or for development/testing:

```bash
npm run dev
```

## Docker Deployment (Alternative Method)

If you're using Docker, you can use this Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install system dependencies including TTS engines
RUN apk add --no-cache \
    build-base \
    cmake \
    espeak-ng-dev \
    libsndfile-dev \
    jq \
    ffmpeg \
    && apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing/ rhvoice

# Download and install Piper
RUN wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz \
    && tar -xzf piper_linux_x86_64.tar.gz \
    && cp piper /usr/local/bin/ \
    && chmod +x /usr/local/bin/piper \
    && rm piper_linux_x86_64.tar.gz

# Create models directory
RUN mkdir -p /opt/piper/models

# Download voice models
RUN wget -O /opt/piper/models/en_US-lessac-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-lessac-medium.onnx" \
    && wget -O /opt/piper/models/ru_RU-irina-medium.onnx "https://github.com/rhasspy/piper/releases/download/v0.0.2/ru_RU-irina-medium.onnx"

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues:

1. **"command not found" errors**: Verify that the TTS binaries are installed and in the PATH:
   ```bash
   which piper
   which RHVoice-test
   ```

2. **Database connection errors**: Make sure your DATABASE_URL is properly configured and the database is accessible.

3. **Permission errors**: Ensure the web server user can access the TTS binaries and storage directories.

4. **Model files not found**: Verify that model files exist in `/opt/piper/models/` and have proper permissions.

### Verification Commands:

```bash
# Check if TTS binaries exist
ls -la /usr/local/bin/piper
ls -la /usr/bin/RHVoice-test

# Check if model files exist
ls -la /opt/piper/models/

# Check if storage directory exists and is writable
ls -la /var/www/reader.market/storage/tts

# Test database connectivity
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL);"
```

### Log Files:

Check the application logs for TTS-related errors:

```bash
# If using systemd
journalctl -u your-app-service -f

# If using pm2
pm2 logs

# Or check the logs directory if the app writes to files
ls -la logs/
```

## Production Considerations

1. **Security**: Restrict access to the TTS endpoints to authenticated users only.

2. **Resource Management**: TTS generation can be CPU-intensive. Monitor system resources and consider limiting concurrent TTS requests.

3. **Caching**: The application caches generated audio files. Monitor the storage used by the TTS cache directory.

4. **Backup**: Include the TTS storage directory in your backup strategy.

## Updating TTS Configuration

If you need to change TTS settings after deployment, you can update the database directly:

```sql
UPDATE tts_config SET 
  default_provider = 'piper',
  tts_enabled = true,
  enabled_providers = '["piper"]'  -- Only enable Piper if RHVoice isn't installed
WHERE id = 'default';
```

Then restart the application for changes to take effect.