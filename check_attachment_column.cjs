const { Pool } = require('pg');

async function checkAttachmentColumn() {
  const pool = new Pool({
    user: 'booksuser',
    host: 'localhost',
    database: 'booksdb',
    password: 'bookspassword',
    port: 5432,
  });

  try {
    // Check if attachment_metadata column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'messages' 
      AND column_name IN ('attachment_metadata', 'attachment_urls')
      ORDER BY column_name;
    `);
    
    console.log('✅ Attachment columns in messages table:');
    console.table(columnCheck.rows);
    
    // Try to insert a test message with attachment metadata
    const testInsert = await pool.query(`
      INSERT INTO messages (
        sender_id, 
        recipient_id, 
        conversation_id, 
        content, 
        attachment_metadata
      ) VALUES (
        '605db90f-4691-4281-991e-b2e248e33915',
        '9cc86c83-dc21-4feb-b526-5b87249b7c8c',
        '635c6c33-445d-4e68-b2f9-84b1da71effe',
        'TEST MESSAGE',
        '{"attachments": [{"url": "/test.jpg", "filename": "test.jpg"}]}'::jsonb
      )
      RETURNING id, attachment_metadata;
    `);
    
    console.log('\n✅ Test insert successful:');
    console.log('Message ID:', testInsert.rows[0].id);
    console.log('Attachment Metadata:', testInsert.rows[0].attachment_metadata);
    
    // Clean up test message
    await pool.query(`DELETE FROM messages WHERE id = $1`, [testInsert.rows[0].id]);
    console.log('\n✅ Test message cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

checkAttachmentColumn();
