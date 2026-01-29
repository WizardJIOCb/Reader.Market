const { db } = require('../server/storage');
const { bookmarkCollections, users } = require('../shared/schema');
const { eq, and, or } = require('drizzle-orm');

async function testCollectionVisibility() {
  try {
    // Test a specific collection ID that might be having issues
    const testCollectionId = '04202325-746f-4d67-a5a9-fd53a1ec405e'; // The one mentioned in your example
    
    console.log('=== TESTING COLLECTION VISIBILITY ===\n');
    
    // First, get the collection details
    const collectionInfo = await db.select({
      id: bookmarkCollections.id,
      name: bookmarkCollections.name,
      userId: bookmarkCollections.userId,
      isPublic: bookmarkCollections.isPublic,
      ownerId: users.id,
      ownerUsername: users.username,
      ownerFullName: users.fullName
    })
    .from(bookmarkCollections)
    .leftJoin(users, eq(bookmarkCollections.userId, users.id))
    .where(eq(bookmarkCollections.id, testCollectionId));
    
    if (collectionInfo.length === 0) {
      console.log('❌ Collection not found with ID:', testCollectionId);
      return;
    }
    
    const collection = collectionInfo[0];
    console.log('Collection Details:');
    console.log('- ID:', collection.id);
    console.log('- Name:', collection.name);
    console.log('- Owner ID:', collection.userId);
    console.log('- Owner Username:', collection.ownerUsername);
    console.log('- Is Public:', collection.isPublic ? 'Yes' : 'No');
    console.log('');
    
    // Test access for different scenarios
    console.log('=== ACCESS TESTS ===');
    
    // Test 1: Access by owner
    const ownerAccess = await db.select()
      .from(bookmarkCollections)
      .where(and(
        eq(bookmarkCollections.id, testCollectionId),
        eq(bookmarkCollections.userId, collection.userId)
      ));
    
    console.log('Owner access test:', ownerAccess.length > 0 ? '✅ SUCCESS' : '❌ FAILED');
    
    // Test 2: Access by other user (public collection)
    if (collection.isPublic) {
      const publicAccess = await db.select()
        .from(bookmarkCollections)
        .where(and(
          eq(bookmarkCollections.id, testCollectionId),
          eq(bookmarkCollections.isPublic, true)
        ));
      
      console.log('Public access test:', publicAccess.length > 0 ? '✅ SUCCESS' : '❌ FAILED');
    } else {
      console.log('Public access test: SKIPPED (collection is private)');
    }
    
    // Test 3: Current access logic (owner OR public)
    const currentLogic = await db.select()
      .from(bookmarkCollections)
      .where(and(
        eq(bookmarkCollections.id, testCollectionId),
        or(
          eq(bookmarkCollections.userId, collection.userId),
          eq(bookmarkCollections.isPublic, true)
        )
      ));
    
    console.log('Current access logic test:', currentLogic.length > 0 ? '✅ SUCCESS' : '❌ FAILED');
    
    console.log('\n=== RECOMMENDATIONS ===');
    if (!collection.isPublic) {
      console.log('💡 To make this collection viewable by others:');
      console.log('   1. Go to the collection edit page');
      console.log('   2. Enable the "Public" toggle');
      console.log('   3. Save the changes');
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCollectionVisibility();