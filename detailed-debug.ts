import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, shelves, shelfBooks, books } from "./shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import dotenv from 'dotenv';

dotenv.config();

async function detailedDebug() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  const db = drizzle(pool);
  
  try {
    console.log('🔍 Detailed debugging for WizardJIOCb...\n');
    
    // 1. Найдем пользователя
    const userResult = await db.select().from(users).where(eq(users.username, 'WizardJIOCb'));
    const user = userResult[0];
    console.log('👤 User:', user.username, `(${user.id})\n`);
    
    // 2. Получим все полки пользователя
    const userShelves = await db.select().from(shelves).where(eq(shelves.userId, user.id));
    console.log(`📚 User has ${userShelves.length} shelves:`);
    userShelves.forEach(shelf => {
      console.log(`   ${shelf.name} (${shelf.id})`);
    });
    console.log('');
    
    // 3. Проверим связи shelf_books
    console.log('🔗 Shelf-Book associations:');
    for (const shelf of userShelves) {
      const associations = await db.select().from(shelfBooks).where(eq(shelfBooks.shelfId, shelf.id));
      console.log(`   ${shelf.name}: ${associations.length} books`);
      associations.forEach(assoc => {
        console.log(`     - Book ID: ${assoc.bookId}`);
      });
    }
    console.log('');
    
    // 4. Проверим сами книги
    console.log('📖 All books in database:');
    const allBooks = await db.select().from(books);
    console.log(`   Total books: ${allBooks.length}`);
    
    const activeBooks = allBooks.filter(book => book.isActive);
    console.log(`   Active books: ${activeBooks.length}`);
    
    const userBookIds: string[] = [];
    for (const shelf of userShelves) {
      const associations = await db.select().from(shelfBooks).where(eq(shelfBooks.shelfId, shelf.id));
      userBookIds.push(...associations.map(a => a.bookId));
    }
    
    const uniqueUserBookIds = [...new Set(userBookIds)];
    console.log(`   User's book IDs: ${uniqueUserBookIds.length}`);
    console.log('   IDs:', uniqueUserBookIds);
    console.log('');
    
    // 5. Проверим конкретные книги пользователя
    console.log('🎯 User\'s books details:');
    for (const bookId of uniqueUserBookIds) {
      const book = allBooks.find(b => b.id === bookId);
      if (book) {
        console.log(`   ${book.title} by ${book.author}`);
        console.log(`     ID: ${book.id}`);
        console.log(`     Active: ${book.isActive}`);
        console.log(`     Created: ${book.createdAt}`);
        console.log('');
      } else {
        console.log(`   ❌ Book ID ${bookId} not found in books table!`);
      }
    }
    
    // 6. Симуляция логики getShelvesWithBooks
    console.log('🧪 Simulating getShelvesWithBooks method:');
    
    // Получаем книги по ID
    const booksById = await db.select().from(books).where(
      and(
        inArray(books.id, uniqueUserBookIds),
        eq(books.isActive, true)
      )
    );
    
    console.log(`   Books found by ID and active: ${booksById.length}`);
    booksById.forEach(book => {
      console.log(`     ${book.title} (${book.id}) - active: ${book.isActive}`);
    });
    
    if (booksById.length !== uniqueUserBookIds.length) {
      console.log('   ⚠️  MISMATCH! Some books not found or not active');
      const foundIds = booksById.map(b => b.id);
      const missingIds = uniqueUserBookIds.filter(id => !foundIds.includes(id));
      console.log('   Missing book IDs:', missingIds);
      
      // Проверим, почему книги не находятся
      for (const missingId of missingIds) {
        const bookCheck = await db.select().from(books).where(eq(books.id, missingId));
        if (bookCheck.length > 0) {
          console.log(`   Book ${missingId} exists but isActive=${bookCheck[0].isActive}`);
        } else {
          console.log(`   Book ${missingId} does not exist in books table`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

detailedDebug();