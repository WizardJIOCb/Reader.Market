-- Add book translations table for storing translated versions of books
CREATE TABLE IF NOT EXISTS book_translations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id VARCHAR NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  translation_type VARCHAR(20) NOT NULL, -- 'automated' | 'manual'
  translation_service VARCHAR(50), -- 'ollama' | 'libretranslate' | 'google' | 'deepl' | null
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf' | 'epub' | 'fb2' | 'txt'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  progress INTEGER DEFAULT 0, -- 0-100 for automated translations
  error_message TEXT,
  translated_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for fast lookups by book and language
CREATE INDEX idx_book_translations_book_language ON book_translations(book_id, language);

-- Index for filtering by status
CREATE INDEX idx_book_translations_status ON book_translations(status);
