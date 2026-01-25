// Check current TTS config in database
import { db } from '../server/dist/storage/index.js';
import { ttsConfig } from '../server/dist/shared/schema/index.js';

async function checkTtsConfig() {
  try {
    console.log('Checking TTS config in database...');
    
    // Check if any TTS config exists
    const configs = await db.select().from(ttsConfig);
    console.log('Total TTS config records:', configs.length);
    
    if (configs.length > 0) {
      console.log('Existing configs:');
      configs.forEach((config, index) => {
        console.log(`Config ${index + 1}:`, {
          id: config.id,
          ttsEnabled: config.ttsEnabled,
          enabledProviders: config.enabledProviders,
          defaultProvider: config.defaultProvider,
          defaultRate: config.defaultRate,
          updatedAt: config.updatedAt
        });
        
        // Check if enabledProviders is string or array
        console.log('enabledProviders type:', typeof config.enabledProviders);
        if (typeof config.enabledProviders === 'string') {
          try {
            const parsed = JSON.parse(config.enabledProviders);
            console.log('enabledProviders parsed as array:', parsed);
          } catch (e) {
            console.log('enabledProviders is string but not valid JSON');
          }
        }
      });
    } else {
      console.log('No TTS config records found');
    }
    
  } catch (error) {
    console.error('Error checking TTS config:', error);
  }
}

checkTtsConfig();