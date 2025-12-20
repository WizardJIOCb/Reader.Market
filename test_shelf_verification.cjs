const { storage } = require('./dist/server/storage');

async function testShelf() {
  try {
    // Test if the shelf exists
    const shelfId = '08d1454e-0296-4587-b0d3-b9ecb96082a4';
    console.log(`Checking if shelf ${shelfId} exists...`);
    
    const shelf = await storage.getShelf(shelfId);
    console.log('Shelf found:', shelf);
    
    if (shelf) {
      console.log(`Shelf belongs to user: ${shelf.userId}`);
    } else {
      console.log('Shelf not found in database');
    }
    
    // Also check all shelves for the user
    console.log('\nChecking all shelves...');
    // You would need to provide a valid userId here
    // const allShelves = await storage.getShelves(userId);
    // console.log('All shelves:', allShelves);
  } catch (error) {
    console.error('Error:', error);
  }
}

testShelf();