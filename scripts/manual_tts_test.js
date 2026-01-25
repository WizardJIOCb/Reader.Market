// Manual TTS config test - run this in browser console on TTS admin page

(async function manualTtsTest() {
  console.warn('=== MANUAL TTS CONFIG TEST ===');
  
  // Step 1: Check authentication
  const authToken = localStorage.getItem('authToken');
  console.warn('[STEP-1] Auth token present:', !!authToken);
  
  if (!authToken) {
    console.error('[STEP-1] No auth token found! Please log in first.');
    return;
  }
  
  // Step 2: Fetch current TTS config
  console.warn('[STEP-2] Fetching current TTS config...');
  try {
    const response = await fetch('/api/tts/admin/config', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    console.warn('[STEP-2] Response status:', response.status);
    
    if (response.ok) {
      const config = await response.json();
      console.warn('[STEP-2] Current config:', config);
      
      // Debug: Check what fields are null
      console.warn('[STEP-2] Field analysis:');
      Object.keys(config).forEach(key => {
        console.warn(`  ${key}:`, config[key], `(type: ${typeof config[key]})`);
      });
      
      // Step 3: Modify and save config
      console.warn('[STEP-3] Modifying config...');
      
      // First, determine new providers list
      const newProviders = config.enabledProviders.includes('piper') 
        ? ['rhvoice'] 
        : ['rhvoice', 'piper'];
      
      // Ensure defaultProvider is in the new providers list
      let newDefaultProvider = config.defaultProvider;
      if (!newProviders.includes(config.defaultProvider)) {
        newDefaultProvider = newProviders[0]; // Use first available provider
        console.warn('[STEP-3] Switching default provider from', config.defaultProvider, 'to', newDefaultProvider);
      }
      
      // Ensure all numeric fields have proper defaults
      const modifiedConfig = {
        ...config,
        id: config.id || 'default',
        ttsEnabled: !config.ttsEnabled, // Toggle the TTS enable setting
        defaultRate: config.defaultRate === 1.00 ? 1.25 : 1.00, // Change speed
        minRate: typeof config.minRate === 'number' && !isNaN(config.minRate) ? config.minRate : 0.80,
        maxRate: typeof config.maxRate === 'number' && !isNaN(config.maxRate) ? config.maxRate : 1.25,
        chunkMinChars: typeof config.chunkMinChars === 'number' && !isNaN(config.chunkMinChars) ? config.chunkMinChars : 400,
        chunkMaxChars: typeof config.chunkMaxChars === 'number' && !isNaN(config.chunkMaxChars) ? config.chunkMaxChars : 1800,
        mp3Bitrate: typeof config.mp3Bitrate === 'number' && !isNaN(config.mp3Bitrate) ? config.mp3Bitrate : 64,
        queueConcurrency: typeof config.queueConcurrency === 'number' && !isNaN(config.queueConcurrency) ? config.queueConcurrency : 1,
        cacheMaxGb: typeof config.cacheMaxGb === 'number' && !isNaN(config.cacheMaxGb) ? config.cacheMaxGb : 20,
        cacheTtlDays: typeof config.cacheTtlDays === 'number' && !isNaN(config.cacheTtlDays) ? config.cacheTtlDays : 90,
        defaultLang: typeof config.defaultLang === 'string' ? config.defaultLang : 'en',
        defaultVoiceRu: typeof config.defaultVoiceRu === 'string' ? config.defaultVoiceRu : '',
        defaultVoiceEn: typeof config.defaultVoiceEn === 'string' ? config.defaultVoiceEn : '',
        audioFormat: typeof config.audioFormat === 'string' ? config.audioFormat : 'mp3',
        rhvoiceBinPath: typeof config.rhvoiceBinPath === 'string' ? config.rhvoiceBinPath : '',
        piperBinPath: typeof config.piperBinPath === 'string' ? config.piperBinPath : '',
        piperModelsDir: typeof config.piperModelsDir === 'string' ? config.piperModelsDir : '',
        enabledProviders: newProviders,
        defaultProvider: newDefaultProvider
      };
      
      console.warn('[STEP-3] Modified config to save:', modifiedConfig);
      
      // Step 4: Save the modified config
      console.warn('[STEP-4] Saving modified config...');
      const saveResponse = await fetch('/api/tts/admin/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modifiedConfig)
      });
      
      console.warn('[STEP-4] Save response status:', saveResponse.status);
      
      if (saveResponse.ok) {
        console.warn('[STEP-4] ✅ Config saved successfully!');
        
        // Step 5: Verify the save by fetching again
        console.warn('[STEP-5] Verifying saved config...');
        const verifyResponse = await fetch('/api/tts/admin/config', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (verifyResponse.ok) {
          const verifiedConfig = await verifyResponse.json();
          console.warn('[STEP-5] Verified config:', verifiedConfig);
          
          // Check if our changes were saved
          const ttsEnabledChanged = verifiedConfig.ttsEnabled !== config.ttsEnabled;
          const defaultRateChanged = verifiedConfig.defaultRate !== config.defaultRate;
          const providersChanged = JSON.stringify(verifiedConfig.enabledProviders) !== JSON.stringify(config.enabledProviders);
          
          console.warn('[STEP-5] Changes verified:');
          console.warn('  - TTS Enabled changed:', ttsEnabledChanged, `(was: ${config.ttsEnabled}, now: ${verifiedConfig.ttsEnabled})`);
          console.warn('  - Default Rate changed:', defaultRateChanged, `(was: ${config.defaultRate}, now: ${verifiedConfig.defaultRate})`);
          console.warn('  - Providers changed:', providersChanged, `(was: ${JSON.stringify(config.enabledProviders)}, now: ${JSON.stringify(verifiedConfig.enabledProviders)})`);
          
          if (ttsEnabledChanged && defaultRateChanged && providersChanged) {
            console.warn('[SUCCESS] ✅ All TTS settings are properly persisting!');
          } else {
            console.warn('[ISSUE] ⚠️ Some settings may not be persisting correctly');
          }
        }
      } else {
        const errorText = await saveResponse.text();
        console.error('[STEP-4] ❌ Failed to save config:', saveResponse.status, errorText);
      }
    } else {
      const errorText = await response.text();
      console.error('[STEP-2] ❌ Failed to fetch config:', response.status, errorText);
    }
  } catch (error) {
    console.error('[ERROR] Test failed:', error);
  }
  
  console.warn('=== MANUAL TTS CONFIG TEST COMPLETED ===');
})();