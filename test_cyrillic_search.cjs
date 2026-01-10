const { DBStorage } = require('./server/storage');
const storage = new DBStorage();

// Test function to verify Cyrillic search functionality
async function testCyrillicSearch() {
  console.log('Testing Cyrillic search functionality...');
  
  try {
    // Test search for "Гиперион" which was mentioned in the issue
    const query = "Гиперион";
    console.log(`Searching for: "${query}"`);
    
    const results = await storage.searchBooks(query, undefined, 'desc');
    console.log(`Found ${results.length} results for "${query}":`);
    
    if (results.length > 0) {
      results.forEach((book, index) => {
        console.log(`${index + 1}. Title: "${book.title}", Author: "${book.author}"`);
      });
    } else {
      console.log(`No results found for "${query}". This might indicate the issue still exists or there are no matching books in the database.`);
    }
    
    // Test with another Cyrillic query
    const query2 = "Дэн Симмонс";
    console.log(`\nSearching for: "${query2}"`);
    
    const results2 = await storage.searchBooks(query2, undefined, 'desc');
    console.log(`Found ${results2.length} results for "${query2}":`);
    
    if (results2.length > 0) {
      results2.forEach((book, index) => {
        console.log(`${index + 1}. Title: "${book.title}", Author: "${book.author}"`);
      });
    } else {
      console.log(`No results found for "${query2}".`);
    }
    
    // Test with English query to ensure we didn't break existing functionality
    const query3 = "test";
    console.log(`\nSearching for: "${query3}"`);
    
    const results3 = await storage.searchBooks(query3, undefined, 'desc');
    console.log(`Found ${results3.length} results for "${query3}":`);
    
    if (results3.length > 0) {
      results3.forEach((book, index) => {
        console.log(`${index + 1}. Title: "${book.title}", Author: "${book.author}"`);
      });
    } else {
      console.log(`No results found for "${query3}".`);
    }
    
    console.log('\nCyrillic search test completed.');
  } catch (error) {
    console.error('Error during Cyrillic search test:', error);
  }
}

// Run the test
testCyrillicSearch();