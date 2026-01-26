const { db } = require('../server/storage');
const { bookmarkCollections, users } = require('../shared/schema');
const { eq, and, or } = require('drizzle-orm');

async function testCollectionData() {
  try {
    const collectionId = 'a5dc9028-dbf0-4efb-95e9-ddea095cab5f';
    
    // Get collection with owner information
    const result = await db.select({
      id: bookmarkCollections.id,
      userId: bookmarkCollections.userId,
      name: bookmarkCollections.name,
      ownerId: users.id,
      ownerUsername: users.username,
      ownerFullName: users.fullName,
      ownerAvatarUrl: users.avatarUrl,
      ownerProfileRating: users.profileRating
    })
    .from(bookmarkCollections)
    .leftJoin(users, eq(bookmarkCollections.userId, users.id))
    .where(and(
      eq(bookmarkCollections.id, collectionId)
    ));
    
    console.log('Collection data:', JSON.stringify(result[0], null, 2));
    
    // Also check if user exists and has rating
    if (result[0]?.userId) {
      const userResult = await db.select().from(users).where(eq(users.id, result[0].userId));
      console.log('User data:', JSON.stringify(userResult[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCollectionData();