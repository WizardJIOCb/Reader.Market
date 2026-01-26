-- Migration: Add bookmark collections functionality
-- Creates tables for bookmark collections and collection items

-- Table for bookmark collections (thematic groups)
CREATE TABLE bookmark_collections (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color code
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table for bookmark collection items (many-to-many relationship)
CREATE TABLE bookmark_collection_items (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id VARCHAR NOT NULL REFERENCES bookmark_collections(id) ON DELETE CASCADE,
    bookmark_id VARCHAR NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(collection_id, bookmark_id) -- Prevent duplicate bookmarks in same collection
);

-- Indexes for better performance
CREATE INDEX idx_bookmark_collections_user_id ON bookmark_collections(user_id);
CREATE INDEX idx_bookmark_collections_created_at ON bookmark_collections(created_at);
CREATE INDEX idx_bookmark_collection_items_collection_id ON bookmark_collection_items(collection_id);
CREATE INDEX idx_bookmark_collection_items_bookmark_id ON bookmark_collection_items(bookmark_id);

-- Comments for documentation
COMMENT ON TABLE bookmark_collections IS 'User-created thematic collections of bookmarks';
COMMENT ON TABLE bookmark_collection_items IS 'Associative table linking bookmarks to collections';