const { Client } = require('pg');

async function insertTtsConfig() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public",
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Insert default TTS configuration
    const result = await client.query(`
      INSERT INTO tts_config (id, tts_enabled, enabled_providers, default_provider, default_lang, default_rate, min_rate, max_rate, chunk_min_chars, chunk_max_chars, audio_format, mp3_bitrate, queue_concurrency, cache_max_gb, cache_ttl_days, rhvoice_bin_path, piper_bin_path, piper_models_dir)
      VALUES (
        gen_random_uuid(),
        true,
        '["rhvoice","piper"]'::jsonb,
        'piper',
        'en',
        1.00,
        0.80,
        1.25,
        400,
        1800,
        'mp3',
        64,
        1,
        20,
        90,
        '/usr/bin/RHVoice-test',
        '/usr/local/bin/piper',
        '/opt/piper/models'
      )
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);

    if (result.rowCount > 0) {
      console.log('✅ TTS configuration inserted successfully');
      console.log('Config ID:', result.rows[0].id);
    } else {
      console.log('ℹ️  TTS configuration already exists');
    }

  } catch (error) {
    console.error('❌ Error inserting TTS config:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

insertTtsConfig();