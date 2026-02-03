-- Migration: Update TTS binary paths
-- Description: Update TTS configuration with proper binary paths for Windows compatibility

-- Update the TTS configuration with proper paths
UPDATE tts_config 
SET 
    rhvoiceBinPath = 'C:\Program Files\RHVoice\bin\RHVoice-test.exe',
    piperBinPath = 'piper',  -- This should work if installed via pip
    piperModelsDir = 'C:\opt\piper\models',
    defaultVoiceRu = COALESCE(NULLIF(defaultVoiceRu, ''), 'ru_RU-irina'),
    defaultVoiceEn = COALESCE(NULLIF(defaultVoiceEn, ''), 'en_US-lessac'),
    enabledProviders = COALESCE(NULLIF(enabledProviders::text, ''), '["piper","rhvoice"]')::jsonb
WHERE id = 'default';

-- Verify the update
DO $$
DECLARE
    config_record RECORD;
BEGIN
    SELECT * INTO config_record FROM tts_config WHERE id = 'default';
    RAISE NOTICE 'TTS Configuration updated:';
    RAISE NOTICE '  Enabled: %', config_record.ttsEnabled;
    RAISE NOTICE '  Providers: %', config_record.enabledProviders;
    RAISE NOTICE '  Piper Path: %', config_record.piperBinPath;
    RAISE NOTICE '  Models Dir: %', config_record.piperModelsDir;
END $$;