// Simple debug script to test Foliate.js import and instantiation
async function testFoliateImport() {
  try {
    console.log('Attempting to import Foliate.js...');
    const { Reader } = await import('foliate-js/reader.js');
    console.log('Foliate.js imported successfully');
    console.log('Reader class:', Reader);
    
    // Create a simple container for testing
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    console.log('Creating Reader instance...');
    const reader = new Reader(container, {});
    console.log('Reader instance created:', reader);
    
    // Clean up
    document.body.removeChild(container);
    
    return true;
  } catch (error) {
    console.error('Error testing Foliate.js:', error);
    return false;
  }
}

// Run the test
testFoliateImport().then(success => {
  console.log('Foliate.js test result:', success ? 'SUCCESS' : 'FAILED');
});

export {};