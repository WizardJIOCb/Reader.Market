-- SQL script to set up TTS configuration in the database
-- Run this directly against your PostgreSQL database

-- Create the tts_config table if it doesn't exist (in case migrations haven't run)
CREATE TABLE IF NOT EXISTS tts_config (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tts_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    enabled_providers JSONB DEFAULT '["piper", "rhvoice"]'::jsonb NOT NULL,
    default_provider TEXT DEFAULT 'piper' NOT NULL,
    default_lang VARCHAR(10) DEFAULT 'en' NOT NULL,
    default_voice_ru TEXT,
    default_voice_en TEXT,
    default_rate NUMERIC(3,2) DEFAULT 1.00 NOT NULL,
    min_rate NUMERIC(3,2) DEFAULT 0.80 NOT NULL,
    max_rate NUMERIC(3,2) DEFAULT 1.25 NOT NULL,
    chunk_min_chars INTEGER DEFAULT 400 NOT NULL,
    chunk_max_chars INTEGER DEFAULT 1800 NOT NULL,
    audio_format TEXT DEFAULT 'mp3' NOT NULL,
    mp3_bitrate INTEGER DEFAULT 64 NOT NULL,
    queue_concurrency INTEGER DEFAULT 1 NOT NULL,
    cache_max_gb INTEGER DEFAULT 20 NOT NULL,
    cache_ttl_days INTEGER DEFAULT 90 NOT NULL,
    rhvoice_bin_path TEXT DEFAULT 'C:\\Program Files\\RHVoice\\bin\\RHVoice-test.exe',
    piper_bin_path TEXT DEFAULT 'piper',
    piper_models_dir TEXT DEFAULT 'C:\\opt\\piper\\models',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_tts_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger if it doesn't exist
CREATE OR REPLACE TRIGGER update_tts_config_updated_at_trigger
BEFORE UPDATE ON tts_config
FOR EACH ROW EXECUTE FUNCTION update_tts_config_updated_at();

-- Insert or update the default TTS configuration
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
    '["piper"]',  -- Start with piper only for Windows compatibility
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
    'C:\\Program Files\\RHVoice\\bin\\RHVoice-test.exe',  -- Windows path
    'piper',  -- This will work if installed via pip
    'C:\\opt\\piper\\models'  -- Windows path
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

-- Verify the configuration was created
SELECT * FROM tts_config WHERE id = 'default';