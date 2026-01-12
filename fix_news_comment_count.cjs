const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixNewsCommentCount() {
  try {
    const newsId = 'f087b1fa-b7a0-4b73-87df-9e523b8cf20f';
    
    console.log(`\nChecking comment count for news ${newsId}...\n`);
    
    // Get the actual comment count from comments table
    const actualCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM comments WHERE news_id = $1',
      [newsId]
    );
    const actualCount = parseInt(actualCountResult.rows[0].count);
    console.log(`✓ Actual comments in database: ${actualCount}`);
    
    // Get the stored comment count from news table
    const newsResult = await pool.query(
      'SELECT comment_count, title FROM news WHERE id = $1',
      [newsId]
    );
    
    if (newsResult.rows.length === 0) {
      console.error('✗ News item not found');
      return;
    }
    
    const storedCount = newsResult.rows[0].comment_count;
    console.log(`✓ Stored commentCount in news table: ${storedCount}`);
    console.log(`✓ News title: "${newsResult.rows[0].title}"`);
    
    if (actualCount === storedCount) {
      console.log('\n✅ Comment count is already correct! No fix needed.');
      return;
    }
    
    console.log(`\n⚠️  Mismatch detected! Fixing...`);
    
    // Update the news table with the correct count
    await pool.query(
      'UPDATE news SET comment_count = $1, updated_at = NOW() WHERE id = $2',
      [actualCount, newsId]
    );
    
    console.log(`✅ Fixed! Updated commentCount from ${storedCount} to ${actualCount}`);
    
    // Verify the fix
    const verifyResult = await pool.query(
      'SELECT comment_count FROM news WHERE id = $1',
      [newsId]
    );
    console.log(`✓ Verified: New commentCount is ${verifyResult.rows[0].comment_count}`);
    
  } catch (error) {
    console.error('Error fixing comment count:', error);
  } finally {
    await pool.end();
  }
}

fixNewsCommentCount();
