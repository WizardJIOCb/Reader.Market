const { Client } = require('pg');

async function findTextInBook() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'booksdb',
    user: 'booksuser',
    password: 'bookspassword'
  });

  try {
    await client.connect();
    
    // Check if the text exists anywhere in the book
    const textToFind = 'Не звучит ни единого слова';
    
    console.log(`Searching for text: "${textToFind}"`);
    
    // Check all chapters for this text
    const chapters = await client.query(`
      SELECT index, title 
      FROM chapters 
      WHERE book_id = '4f9af291-1f3e-4b47-ad87-47216516bf3b'
      ORDER BY index
    `);
    
    console.log(`Found ${chapters.rows.length} chapters in the book`);
    
    let found = false;
    for (const chapter of chapters.rows) {
      const contentCheck = await client.query(`
        SELECT position($1 in content) as pos
        FROM chapters 
        WHERE book_id = '4f9af291-1f3e-4b47-ad87-47216516bf3b'
        AND index = $2
      `, [textToFind, chapter.index]);
      
      if (contentCheck.rows[0].pos > 0) {
        console.log(`✅ Text found in chapter ${chapter.index}: "${chapter.title}"`);
        console.log(`   Position: ${contentCheck.rows[0].pos}`);
        found = true;
      }
    }
    
    if (!found) {
      console.log('❌ Text not found in any chapter of this book');
      
      // Let's check what similar text exists
      console.log('\nSearching for similar phrases...');
      const similarPhrases = [
        'звучит',
        'единого',
        'слова',
        'Не звучит',
        'единого слова'
      ];
      
      for (const phrase of similarPhrases) {
        const phraseCheck = await client.query(`
          SELECT index, title, position($1 in content) as pos
          FROM chapters 
          WHERE book_id = '4f9af291-1f3e-4b47-ad87-47216516bf3b'
          AND content ILIKE '%' || $1 || '%'
          ORDER BY index
        `, [phrase]);
        
        if (phraseCheck.rows.length > 0) {
          console.log(`Found phrase "${phrase}" in:`);
          phraseCheck.rows.forEach(row => {
            console.log(`  Chapter ${row.index}: "${row.title}" (pos: ${row.pos})`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

findTextInBook();