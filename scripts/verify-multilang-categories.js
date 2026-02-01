import 'dotenv/config';
import { db } from '../server/storage.js';
import { articleCategories } from '../shared/schema.js';

async function verifyMultilangCategories() {
  try {
    console.log('Verifying multilingual article categories...');
    
    // Fetch all categories
    const categories = await db.select().from(articleCategories);
    
    console.log(`Found ${categories.length} categories in the database.\n`);
    
    // Display first few categories to verify multilingual fields exist
    for (let i = 0; i < Math.min(5, categories.length); i++) {
      const cat = categories[i];
      console.log(`Category ${i+1}:`);
      console.log(`  Title (RU): ${cat.title}`);
      console.log(`  Title (EN): ${cat.titleEn || 'N/A'}`);
      console.log(`  Description (RU): ${cat.description || 'N/A'}`);
      console.log(`  Description (EN): ${cat.descriptionEn || 'N/A'}`);
      console.log(`  Slug: ${cat.slug}`);
      console.log('');
    }
    
    // Check if all categories have multilingual fields
    const categoriesWithoutEnglish = categories.filter(cat => 
      !cat.titleEn && !cat.descriptionEn
    );
    
    if (categoriesWithoutEnglish.length > 0) {
      console.log(`Warning: ${categoriesWithoutEnglish.length} categories don't have English translations:`);
      categoriesWithoutEnglish.forEach(cat => {
        console.log(`  - ${cat.title} (${cat.slug})`);
      });
    } else {
      console.log('✅ All categories have English translations!');
    }
    
    console.log(`\n✅ Verification complete! Database has multilingual support for article categories.`);
    
  } catch (error) {
    console.error('Error verifying categories:', error);
  }
}

// Run the function
await verifyMultilangCategories();