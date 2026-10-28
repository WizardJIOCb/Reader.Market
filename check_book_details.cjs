const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { eq } = require("drizzle-orm");

// Since we can't easily import the schema, let's create a simple query
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public",
});

const db = drizzle(pool);

async function checkBookDetails() {
  try {
    console.log("Checking details for book ID: 7fc478fb-a828-43a8-b2b2-eae408f979ef");
    
    // Direct SQL query since we can't easily import the schema
    const result = await db.execute(`
      SELECT id, title, author, file_path, file_type, file_size, published_year, rating 
      FROM books 
      WHERE id = '7fc478fb-a828-43a8-b2b2-eae408f979ef'
    `);
    
    if (result.rows.length > 0) {
      const book = result.rows[0];
      console.log("Book details:");
      console.log("- ID:", book.id);
      console.log("- Title:", book.title);
      console.log("- Author:", book.author);
      console.log("- File Path:", book.file_path);
      console.log("- File Type:", book.file_type);
      console.log("- File Size:", book.file_size);
      console.log("- Published Year:", book.published_year);
      console.log("- Rating:", book.rating);
    } else {
      console.log("Book not found");
    }
  } catch (error) {
    console.error("Error checking book details:", error);
  } finally {
    await pool.end();
  }
}

checkBookDetails();