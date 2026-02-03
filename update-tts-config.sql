-- Update TTS configuration with proper paths for Windows
UPDATE tts_config 
SET 
    rhvoiceBinPath = 'C:\Program Files\RHVoice\bin\RHVoice-test.exe',
    piperBinPath = 'piper',  -- This should work if installed via pip
    piperModelsDir = 'C:\opt\piper\models',
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