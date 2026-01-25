-- Migration: Add TTS (Text-to-Speech) tables
-- Description: Create tables for TTS configuration, cache, and job tracking

-- Table for global TTS configuration managed via admin panel
CREATE TABLE IF NOT EXISTS tts_config (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tts_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    
    enabled_providers JSONB DEFAULT '["rhvoice","piper"]'::jsonb NOT NULL,
    default_provider TEXT DEFAULT 'piper' NOT NULL,
    
    default_lang VARCHAR(10) DEFAULT 'en' NOT NULL,
    default_voice_ru TEXT,
    default_voice_en TEXT,
    
    default_rate NUMERIC(3,2) DEFAULT 1.00 NOT NULL,
    min_rate NUMERIC(3,2) DEFAULT 0.80 NOT NULL,
    max_rate NUMERIC(3,2) DEFAULT 1.25 NOT NULL,
    
    chunk_min_chars INTEGER DEFAULT 400 NOT NULL,
    chunk_max_chars INTEGER DEFAULT 1800 NOT NULL,
    
    audio_format TEXT DEFAULT 'mp3' NOT NULL, -- mp3|ogg
    mp3_bitrate INTEGER DEFAULT 64 NOT NULL,
    
    queue_concurrency INTEGER DEFAULT 1 NOT NULL,
    
    cache_max_gb INTEGER DEFAULT 20 NOT NULL,
    cache_ttl_days INTEGER DEFAULT 90 NOT NULL,
    
    rhvoice_bin_path TEXT DEFAULT '/usr/bin/RHVoice-test',
    piper_bin_path TEXT DEFAULT '/usr/local/bin/piper',
    piper_models_dir TEXT DEFAULT '/opt/piper/models',
    
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tts_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tts_config_updated_at_trigger
BEFORE UPDATE ON tts_config
FOR EACH ROW EXECUTE FUNCTION update_tts_config_updated_at();

-- Insert default configuration if not exists
INSERT INTO tts_config (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Table for caching synthesized audio files
CREATE TABLE IF NOT EXISTS tts_cache (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    
    book_id VARCHAR NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_index INTEGER, -- nullable if no chapters
    chunk_index INTEGER NOT NULL,
    
    provider TEXT NOT NULL, -- rhvoice|piper
    lang VARCHAR(10) NOT NULL, -- ru|en (or ru-RU/en-US, consistent format)
    voice TEXT NOT NULL,
    rate NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    format TEXT NOT NULL, -- mp3|ogg
    
    text_hash TEXT NOT NULL UNIQUE, -- sha256(provider+voice+lang+rate+normalizedText)
    
    audio_path TEXT NOT NULL,
    audio_size INTEGER,
    duration_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_accessed_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for tts_cache
CREATE INDEX IF NOT EXISTS idx_tts_cache_book_chapter_chunk
ON tts_cache(book_id, chapter_index, chunk_index);

CREATE INDEX IF NOT EXISTS idx_tts_cache_last_accessed
ON tts_cache(last_accessed_at);

CREATE INDEX IF NOT EXISTS idx_tts_cache_text_hash
ON tts_cache(text_hash);

-- Optional table for job tracking and debugging
CREATE TABLE IF NOT EXISTS tts_jobs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    text_hash TEXT NOT NULL,
    status TEXT NOT NULL, -- queued|processing|ready|failed
    provider TEXT NOT NULL,
    lang VARCHAR(10) NOT NULL,
    voice TEXT NOT NULL,
    rate NUMERIC(3,2) NOT NULL,
    format TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for tts_jobs
CREATE INDEX IF NOT EXISTS idx_tts_jobs_text_hash 
ON tts_jobs(text_hash);

CREATE INDEX IF NOT EXISTS idx_tts_jobs_status
ON tts_jobs(status);

-- Trigger for tts_jobs updated_at
CREATE OR REPLACE FUNCTION update_tts_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tts_jobs_updated_at_trigger
BEFORE UPDATE ON tts_jobs
FOR EACH ROW EXECUTE FUNCTION update_tts_jobs_updated_at();

-- Add TTS settings to reading_progress.settings JSONB structure
-- This is handled application-side, no schema changes needed

COMMENT ON TABLE tts_config IS 'Global TTS configuration managed via admin panel';
COMMENT ON TABLE tts_cache IS 'Cache of synthesized audio files to avoid re-synthesis';
COMMENT ON TABLE tts_jobs IS 'Optional job tracking for synthesis processes';

COMMENT ON COLUMN tts_config.enabled_providers IS 'JSON array of enabled TTS providers: ["rhvoice", "piper"]';
COMMENT ON COLUMN tts_config.default_provider IS 'Default TTS provider when user has not selected one';
COMMENT ON COLUMN tts_config.chunk_min_chars IS 'Minimum characters per text chunk for synthesis';
COMMENT ON COLUMN tts_config.chunk_max_chars IS 'Maximum characters per text chunk for synthesis';
COMMENT ON COLUMN tts_config.queue_concurrency IS 'Maximum concurrent synthesis jobs';
COMMENT ON COLUMN tts_config.cache_max_gb IS 'Maximum cache size in GB before cleanup';
COMMENT ON COLUMN tts_config.cache_ttl_days IS 'Days to keep unused cache entries';

COMMENT ON COLUMN tts_cache.text_hash IS 'SHA256 hash of provider+voice+lang+rate+normalizedText for deterministic caching';
COMMENT ON COLUMN tts_cache.last_accessed_at IS 'Used for cache cleanup - tracks when audio was last requested';

COMMENT ON COLUMN tts_jobs.status IS 'Current job status: queued (waiting), processing (active), ready (complete), failed (error)';