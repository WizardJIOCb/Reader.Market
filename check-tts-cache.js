const { db } = require('./dist/server/storage.js');
const { ttsCache } = require('./dist/shared/schema.js');
const { eq } = require('drizzle-orm');

async function checkCache() {
  try {
    const records = await db.select().from(ttsCache).where(eq(ttsCache.textHash, '117d2a62ca98a9ab10f6f4190459df631effebef7f709d192185deb48426b9f3'));
    console.log('Cache records:', records);
    
    if (records.length > 0) {
      console.log('Audio path from cache:', records[0].audioPath);
    }
  } catch (error) {
    console.error('Error checking cache:', error);
  }
}

checkCache();