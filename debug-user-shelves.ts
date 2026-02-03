import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, shelves, shelfBooks, books } from "./shared/schema";
import { eq, and } from "drizzle-orm";
import dotenv from 'dotenv';

dotenv.config();

async function debugUserShelves() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  const db = drizzle(pool);
  
  try {
    console.log('🔍 Looking for user WizardJIOCb...');
    
    // Найдем пользователя по username
    const userResult = await db.select().from(users).where(eq(users.username, 'WizardJIOCb'));
    
    if (userResult.length === 0) {
      console.log('❌ User WizardJIOCb not found in database');
      return;
    }
    
    const user = userResult[0];
    console.log('✅ Found user:', {
      id: user.id,
      username: user.username,
      email: user.email
    });
    
    // Проверим полки пользователя
    console.log('\n📚 Checking user shelves...');
    const userShelves = await db.select().from(shelves).where(eq(shelves.userId, user.id));
    
    console.log(`Found ${userShelves.length} shelves:`);
    userShelves.forEach(shelf => {
      console.log(`  - ${shelf.name} (id: ${shelf.id})`);
    });
    
    if (userShelves.length === 0) {
      console.log('❌ No shelves found for this user');
      return;
    }
    
    // Проверим книги в полках
    console.log('\n📖 Checking books in shelves...');
    const shelfIds = userShelves.map(shelf => shelf.id);
    const shelfBooksRecords = await db.select().from(shelfBooks).where(
      eq(shelfBooks.shelfId, shelfIds[0])
    );
    
    console.log(`Found ${shelfBooksRecords.length} book-shelf associations:`);
    const bookIds = [...new Set(shelfBooksRecords.map(record => record.bookId))];
    console.log(`Unique books in shelves: ${bookIds.length}`);
    
    if (bookIds.length > 0) {
      const booksResult = await db.select().from(books).where(and(
        eq(books.isActive, true)
      ));
      
      console.log(`Total active books in database: ${booksResult.length}`);
      
      const userBooks = booksResult.filter(book => bookIds.includes(book.id));
      console.log(`Books belonging to user's shelves: ${userBooks.length}`);
      
      userBooks.forEach(book => {
        console.log(`  - ${book.title} by ${book.author} (id: ${book.id})`);
      });
    }
    
    // Проверим, что метод getShelvesWithBooks должен возвращать
    console.log('\n🧪 Testing getShelvesWithBooks logic...');
    
    if (bookIds.length > 0) {
      // Имитируем часть логики метода
      console.log('Would process books with IDs:', bookIds.slice(0, 3), '...');
    } else {
      console.log('No books to process - would return empty shelves');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await pool.end();
  }
}

debugUserShelves();