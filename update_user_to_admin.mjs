import { storage } from './server/storage.js';

// Function to update user access level to admin
async function updateUserToAdmin() {
  try {
    console.log('Looking for user1...');
    const user = await storage.getUserByUsername('user1');
    
    if (user) {
      console.log('Found user:', user.username, 'with access level:', user.accessLevel);
      
      // Update access level to admin
      const updatedUser = await storage.updateAccessLevel(user.id, 'admin');
      console.log('Updated user access level to:', updatedUser.accessLevel);
      console.log('User is now admin and can access admin endpoints');
    } else {
      console.log('User user1 not found');
    }
  } catch (error) {
    console.error('Error updating user access level:', error);
  }
}

updateUserToAdmin();