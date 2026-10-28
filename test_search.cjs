const fs = require('fs');
const path = require('path');

// Test the search functionality
async function testSearch() {
  try {
    // First, let's check what books we have in the database
    console.log('Testing search functionality...');
    
    // Simulate a search for "1"
    const query = "1";
    console.log(`Searching for: ${query}`);
    
    // This would normally be handled by the database query
    // For now, let's just check if we can read the files
    const uploadsDir = './uploads';
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log('Files in uploads directory:', files);
      
      // Look for files containing "1" in their name
      const matchingFiles = files.filter(file => file.includes(query));
      console.log('Files matching query:', matchingFiles);
    } else {
      console.log('Uploads directory does not exist');
    }
  } catch (error) {
    console.error('Error testing search:', error);
  }
}

testSearch();