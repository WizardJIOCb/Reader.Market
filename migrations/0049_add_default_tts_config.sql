-- Migration: Add default TTS configuration
-- Description: Insert default TTS configuration to ensure TTS functionality works

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
    '["piper"]',  -- Start with piper only for broader compatibility
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
    '/usr/bin/RHVoice-test',  -- Standard Unix path, can be updated for Windows
    '/usr/local/bin/piper',  -- Standard Unix path, can be updated for Windows
    '/opt/piper/models'      -- Standard Unix path, can be updated for Windows
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
DO $$
DECLARE
    config_exists INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_exists FROM tts_config WHERE id = 'default';
    RAISE NOTICE 'TTS configuration setup: % record(s) found', config_exists;
END $$;