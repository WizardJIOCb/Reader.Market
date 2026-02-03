-- Fix TTS configuration paths in the database
UPDATE tts_config 
SET 
    rhvoiceBinPath = CASE 
        WHEN CURRENT_SETTING('system.type') LIKE '%Win%' THEN 'C:\Program Files\RHVoice\bin\RHVoice-test.exe'
        ELSE '/usr/bin/RHVoice-test'
    END,
    piperBinPath = CASE 
        WHEN CURRENT_SETTING('system.type') LIKE '%Win%' THEN 'piper'
        ELSE '/usr/local/bin/piper'
    END,
    piperModelsDir = CASE 
        WHEN CURRENT_SETTING('system.type') LIKE '%Win%' THEN 'C:\opt\piper\models'
        ELSE '/opt/piper/models'
    END,
    defaultVoiceRu = COALESCE(NULLIF(defaultVoiceRu, ''), 'ru_RU-irina'),
    defaultVoiceEn = COALESCE(NULLIF(defaultVoiceEn, ''), 'en_US-lessac')
WHERE id = 'default';

-- Verify the update
SELECT 
    id,
    tts_enabled,
    enabled_providers,
    default_provider,
    rhvoice_bin_path,
    piper_bin_path,
    piper_models_dir,
    default_voice_ru,
    default_voice_en
FROM tts_config 
WHERE id = 'default';