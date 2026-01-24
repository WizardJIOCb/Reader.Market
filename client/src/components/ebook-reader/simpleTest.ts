// Simple test to check if Foliate.js can load a book
async function testFoliateLoading() {
  try {
    
    
    // Import Foliate.js
    const { Reader } = await import('foliate-js/reader.js');
    
    
    // Create a simple container
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    // Create reader instance
    const reader = new Reader(container, {});
    
    
    // Try to load a simple text file
    const testUrl = '/uploads/bookFile-1765972806296-831009501.txt';
    
    
    // Add event listeners
    if (reader.on) {
      reader.on('bookready', () => {
        
      });
      
      reader.on('error', (error: any) => {
        console.error('Book loading error:', error);
      });
    }
    
    // Try to load the book
    const result = await reader.load(testUrl);
    
    
    // Clean up
    document.body.removeChild(container);
    
  } catch (error) {
    console.error('Error in Foliate.js test:', error);
  }
}

// Run the test
testFoliateLoading();

export {};