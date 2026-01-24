// Simple script to check shelves
const { Storage } = require('./server/storage');

async function checkShelves() {
  try {
    console.log('=== Checking Shelves ===');
    
    // Try to get user by username
    const storage = new Storage();
    
    console.log('Looking for user WizardJIOCb...');
    const user = await storage.getUserByUsername('WizardJIOCb');
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:', user.username, user.id);
    
    // Get shelves for this user
    console.log('Getting shelves...');
    const shelves = await storage.getShelves(user.id);
    
    console.log('Shelves found:', shelves.length);
    shelves.forEach((shelf, index) => {
      console.log(`${index + 1}. ${shelf.name} - ${shelf.bookIds ? shelf.bookIds.length : 0} books`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkShelves();