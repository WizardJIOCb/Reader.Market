-- Migration: Add Global Catalog Tables

-- Create global_works table
CREATE TABLE IF NOT EXISTS global_works (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    author_name TEXT NOT NULL,
    year INTEGER,
    language VARCHAR(10),
    wikidata_qid VARCHAR(20), -- Wikidata entity ID
    openlibrary_work_id VARCHAR(255), -- OpenLibrary work ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    discovered_at TIMESTAMP WITH TIME ZONE, -- When first discovered in our system
    discovery_source TEXT, -- openlibrary / wikidata / google / user_search
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'processed', 'failed')), -- pending / processing / processed / failed
    bootstrap_source TEXT, -- Source of initial bootstrap (wikidata, openlibrary)
    bootstrap_at TIMESTAMP WITH TIME ZONE, -- When it was bootstrapped
    external_ids JSONB -- Additional external identifiers (ISBN, etc.)
);

-- Create editions table
CREATE TABLE IF NOT EXISTS editions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id VARCHAR(255) NOT NULL REFERENCES global_works(id) ON DELETE CASCADE,
    isbn10 VARCHAR(10),
    isbn13 VARCHAR(13),
    publisher TEXT,
    year INTEGER,
    language VARCHAR(10),
    source TEXT NOT NULL, -- Where this edition info came from
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create discovery_queue table
CREATE TABLE IF NOT EXISTS discovery_queue (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL, -- The search query or identifier
    type TEXT NOT NULL CHECK (type IN ('user_search', 'global_fill')), -- user_search | global_fill
    priority INTEGER DEFAULT 0 NOT NULL, -- Higher number = higher priority
    attempts INTEGER DEFAULT 0 NOT NULL,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'found', 'failed')), -- pending / found / failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create search_miss_log table
CREATE TABLE IF NOT EXISTS search_miss_log (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_query TEXT NOT NULL, -- The original user query
    normalized_query TEXT NOT NULL, -- Normalized version of the query
    user_id VARCHAR(255) REFERENCES users(id), -- Who searched (nullable for anonymous)
    count INTEGER DEFAULT 1 NOT NULL, -- How many times this query was made
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create bootstrap_progress table
CREATE TABLE IF NOT EXISTS bootstrap_progress (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_identifier VARCHAR(255) NOT NULL, -- Identifier for the batch (e.g., last QID processed)
    source TEXT NOT NULL, -- wikidata, openlibrary, etc.
    records_processed INTEGER DEFAULT 0 NOT NULL, -- Number of records processed in this batch
    status TEXT DEFAULT 'running' NOT NULL CHECK (status IN ('running', 'completed', 'failed')), -- running / completed / failed
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB -- Additional metadata about the bootstrap run
);

-- Create worker_stats table
CREATE TABLE IF NOT EXISTS worker_stats (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_name TEXT NOT NULL, -- Name of the worker (discovery_worker)
    total_processed INTEGER DEFAULT 0 NOT NULL, -- Total items processed
    total_errors INTEGER DEFAULT 0 NOT NULL, -- Total errors occurred
    last_processed_at TIMESTAMP WITH TIME ZONE, -- Last time an item was processed
    active_since TIMESTAMP WITH TIME ZONE, -- When worker became active
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_works_wikidata_qid ON global_works(wikidata_qid);
CREATE INDEX IF NOT EXISTS idx_global_works_normalized_title ON global_works(normalized_title);
CREATE INDEX IF NOT EXISTS idx_global_works_author_name ON global_works(author_name);
CREATE INDEX IF NOT EXISTS idx_global_works_status ON global_works(status);
CREATE INDEX IF NOT EXISTS idx_global_works_year ON global_works(year);

CREATE INDEX IF NOT EXISTS idx_editions_isbn10 ON editions(isbn10);
CREATE INDEX IF NOT EXISTS idx_editions_isbn13 ON editions(isbn13);
CREATE INDEX IF NOT EXISTS idx_editions_work_id ON editions(work_id);

CREATE INDEX IF NOT EXISTS idx_discovery_queue_status ON discovery_queue(status);
CREATE INDEX IF NOT EXISTS idx_discovery_queue_type ON discovery_queue(type);
CREATE INDEX IF NOT EXISTS idx_discovery_queue_priority ON discovery_queue(priority DESC);

CREATE INDEX IF NOT EXISTS idx_search_miss_log_normalized_query ON search_miss_log(normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_miss_log_user_id ON search_miss_log(user_id);

CREATE INDEX IF NOT EXISTS idx_bootstrap_progress_source ON bootstrap_progress(source);
CREATE INDEX IF NOT EXISTS idx_bootstrap_progress_status ON bootstrap_progress(status);

CREATE INDEX IF NOT EXISTS idx_worker_stats_worker_name ON worker_stats(worker_name);