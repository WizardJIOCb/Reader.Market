const fs = require('fs');

// Read the storage.ts file
let content = fs.readFileSync('server/storage.ts', 'utf8');

// Find and replace the specific section in the updateBookmarkCollection function
const oldText = `        .returning({
          id: bookmarkCollections.id,
          userId: bookmarkCollections.userId,
          name: bookmarkCollections.name,
          description: bookmarkCollections.description,
          color: bookmarkCollections.color,
          isPublic: bookmarkCollections.isPublic,
          viewCount: bookmarkCollections.viewCount,
          createdAt: bookmarkCollections.createdAt,
          updatedAt: bookmarkCollections.updatedAt,
          bookId: bookmarkCollections.bookId
        });`;

const newText = `        .returning({
          id: bookmarkCollections.id,
          userId: bookmarkCollections.userId,
          name: bookmarkCollections.name,
          description: bookmarkCollections.description,
          color: bookmarkCollections.color,
          isPublic: bookmarkCollections.isPublic,
          coverImageUrl: bookmarkCollections.coverImageUrl,
          viewCount: bookmarkCollections.viewCount,
          createdAt: bookmarkCollections.createdAt,
          updatedAt: bookmarkCollections.updatedAt,
          bookId: bookmarkCollections.bookId
        });`;

// Replace the old text with the new text
content = content.replace(oldText, newText);

// Write the updated content back to the file
fs.writeFileSync('server/storage.ts', content, 'utf8');

console.log('Successfully updated server/storage.ts');