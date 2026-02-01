import 'dotenv/config';
import { db } from '../server/storage.js';
import { articleCategories } from '../shared/schema.js';

async function checkCategoryHierarchy() {
  try {
    console.log('Checking article category hierarchy...');
    
    // Fetch all categories
    const categories = await db.select().from(articleCategories);
    
    console.log(`Found ${categories.length} categories in the database.\n`);
    
    // Separate parents and children
    const parents = categories.filter(cat => !cat.parentId);
    const children = categories.filter(cat => cat.parentId);
    
    console.log(`Main categories (${parents.length}):`);
    parents.forEach(parent => {
      console.log(`  ${parent.id} - ${parent.title} (${parent.slug})`);
    });
    
    console.log(`\nSubcategories (${children.length}):`);
    children.forEach(child => {
      const parent = categories.find(cat => cat.id === child.parentId);
      console.log(`  ${child.id} - ${child.title} (${child.slug}) -> Parent: ${parent ? parent.title : 'NOT FOUND'}`);
    });
    
    // Check if subcategories are properly linked to parents
    console.log('\nChecking parent-child relationships:');
    const mainSlugs = ['news', 'books', 'reviews', 'collections', 'translations', 'industry', 'clubs', 'community'];
    for (const mainSlug of mainSlugs) {
      const mainCategory = categories.find(cat => cat.slug === mainSlug);
      if (mainCategory) {
        const subcategories = children.filter(child => child.parentId === mainCategory.id);
        console.log(`\n${mainCategory.title} (${mainCategory.slug}): ${subcategories.length} subcategories`);
        subcategories.forEach(sub => {
          console.log(`  - ${sub.title} (${sub.slug})`);
        });
      }
    }

  } catch (error) {
    console.error('Error checking category hierarchy:', error);
  }
}

// Run the function
await checkCategoryHierarchy();