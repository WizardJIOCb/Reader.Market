const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
// We'll need to access the books table differently since we can't import from @shared/schema

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public",
  ssl: false,
});

const db = drizzle(pool);

async function checkBooksDates() {
  try {
    console.log("Checking books and their publishedAt dates...");
    
    // Direct query to get all books
    const result = await db.execute("SELECT id, title, author, published_at, rating FROM books");
    
    console.log(`Total books found: ${result.rows.length}`);
    
    result.rows.forEach((book, index) => {
      console.log(`${index + 1}. Book ID: ${book.id}`);
      console.log(`   Title: ${book.title}`);
      console.log(`   Author: ${book.author}`);
      console.log(`   Published At: ${book.published_at}`);
      console.log(`   Rating: ${book.rating}`);
      console.log("---");
    });
    
    // Close the pool
    await pool.end();
  } catch (error) {
    console.error("Error checking books:", error);
  }
}

checkBooksDates();