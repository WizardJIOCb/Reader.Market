import 'dotenv/config';
import { db } from '../server/storage.js';
import { articleCategories } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function updateCategoryHierarchy() {
  try {
    console.log('Updating article category hierarchy...');
    
    // Fetch all categories
    const categories = await db.select().from(articleCategories);
    
    console.log(`Found ${categories.length} categories in the database.`);
    
    // Define the parent-child relationships
    const relationships = {
      'news': ['news.new-books', 'news.new-translations', 'news.reprints', 'news.adaptations', 'news.awards-events'],
      'books': ['books.no-spoilers', 'books.spoilers', 'books.by-chapters', 'books.theories', 'books.quotes'],
      'reviews': ['reviews.reviews', 'reviews.essays', 'reviews.characters-world', 'reviews.plot-structure', 'reviews.themes'],
      'collections': ['collections.what-next', 'collections.tops', 'collections.by-genre', 'collections.by-mood', 'collections.for-beginners'],
      'translations': ['translations.compare', 'translations.quality', 'translations.glossary', 'translations.excerpts'],
      'industry': ['industry.authors-news', 'industry.interviews', 'industry.publishers', 'industry.trends'],
      'clubs': ['clubs.readalongs', 'clubs.challenges', 'clubs.goals', 'clubs.progress'],
      'community': ['community.product-updates', 'community.qna', 'community.ideas']
    };
    
    // Process each parent category and its children
    for (const [parentSlug, childSlugs] of Object.entries(relationships)) {
      const parentCategory = categories.find(cat => cat.slug === parentSlug);
      
      if (!parentCategory) {
        console.log(`Parent category with slug '${parentSlug}' not found!`);
        continue;
      }
      
      console.log(`\nProcessing parent: ${parentCategory.title} (${parentCategory.slug})`);
      
      for (const childSlug of childSlugs) {
        const childCategory = categories.find(cat => cat.slug === childSlug);
        
        if (!childCategory) {
          console.log(`  Child category with slug '${childSlug}' not found!`);
          continue;
        }
        
        // Update the child's parentId to point to the parent
        await db.update(articleCategories)
          .set({ parentId: parentCategory.id })
          .where(eq(articleCategories.id, childCategory.id));
        
        console.log(`  Linked ${childCategory.title} (${childCategory.slug}) to parent ${parentCategory.title} (${parentCategory.slug})`);
      }
    }
    
    console.log('\nCategory hierarchy update completed!');
    
    // Verify the changes
    const updatedCategories = await db.select().from(articleCategories);
    const parents = updatedCategories.filter(cat => !cat.parentId);
    const children = updatedCategories.filter(cat => cat.parentId);
    
    console.log(`\nVerification:`);
    console.log(`Main categories: ${parents.length}`);
    console.log(`Subcategories: ${children.length}`);
    
    console.log(`\nParent-child relationships:`);
    for (const parent of parents) {
      const childCount = children.filter(child => child.parentId === parent.id).length;
      console.log(`${parent.title} (${parent.slug}): ${childCount} subcategories`);
    }

  } catch (error) {
    console.error('Error updating category hierarchy:', error);
  }
}

// Run the function
await updateCategoryHierarchy();