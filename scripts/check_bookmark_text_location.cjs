const { Client } = require('pg');

async function checkBookmarkTextLocation() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword'
  });

  try {
    await client.connect();
    
    // Check the bookmark's actual chapter content
    const result = await client.query(`
      SELECT b.chapter_index, b.selected_text, c.title as chapter_title
      FROM bookmarks b
      JOIN chapters c ON b.book_id = c.book_id AND b.chapter_index = c.index
      WHERE b.id = '60429f44-ed40-4e8b-81b1-52f98270572c'
    `);
    
    console.log('Bookmark chapter info:', result.rows[0]);
    
    // Check if the text exists in the book at all
    const textCheck = await client.query(`
      SELECT c.index as chapter_index, c.title
      FROM chapters c
      WHERE c.book_id = '4f9af291-1f3e-4b47-ad87-47216516bf3b'
      AND c.content ILIKE '%Нет, господин, — ответил магистр связи%'
    `);
    
    console.log('Chapters containing the text:', textCheck.rows);
    
    // If not found, check all chapters for similar text
    if (textCheck.rows.length === 0) {
      console.log('\nSearching for similar text fragments...');
      const fragmentCheck = await client.query(`
        SELECT c.index as chapter_index, c.title,
               POSITION('магистр связи' IN c.content) as pos
        FROM chapters c
        WHERE c.book_id = '4f9af291-1f3e-4b47-ad87-47216516bf3b'
        AND c.content ILIKE '%магистр связи%'
        ORDER BY c.index
      `);
      
      console.log('Chapters with "магистр связи":', fragmentCheck.rows);
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await client.end();
  }
}

checkBookmarkTextLocation();