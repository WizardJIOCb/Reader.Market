# Search Functionality Issue Analysis

## Problem Statement

The search functionality on the production server is not returning results for specific queries, while the same search works locally. Specifically:

- Query: "Гиперион" (Hyperion)
- API call: `GET https://reader.market/api/books/search?query=%D0%93%D0%B8%D0%BF%D0%B5%D1%80%D0%B8%D0%BE%D0%BD`
- Response: `[]` (empty array)
- Expected: Should return books matching the search term

The same book "Гиперион" is available and accessible through genre filtering:
- Genre API: `https://reader.market/api/books/genre/%D0%9D%D0%B0%D1%83%D1%87%D0%BD%D0%B0%D1%8F%20%D0%A4%D0%B0%D0%BD%D1%82%D0%B0%D1%81%D1%82%D0%B8%D0%BA%D0%B0`
- Returns the expected book with title "Гиперион"

## Context

The search functionality is implemented as part of the book search API endpoint. The issue appears to be environment-specific, working locally but failing on the production server.

## Requirements Analysis

### Functional Requirements
- Search endpoint must return books matching the query string in title, author, or other relevant fields
- Search should handle Cyrillic characters properly
- Search should be case-insensitive
- Search should return relevant results based on matching algorithm

### Non-Functional Requirements
- Search should handle international characters (UTF-8 encoding)
- Search should be performant
- Search should work consistently across environments

## Root Cause Analysis

Based on code inspection, the issue appears to be related to database collation and character encoding differences between environments. The search implementation uses the following query in the `searchBooks` function:

```sql
(LOWER(title) ILIKE '%query%' OR LOWER(author) ILIKE '%query%' OR LOWER(description) ILIKE '%query%' OR LOWER(genre) ILIKE '%query%')
```

Key findings:
1. The database connection in `storage.ts` has `ssl: false` for local development, but production may have different SSL settings
2. The production database may have different collation settings that affect Cyrillic character matching
3. The PostgreSQL ILIKE operation may behave differently with Cyrillic characters depending on locale settings
4. The search pattern construction uses `query.toLowerCase()` which may not properly handle Cyrillic characters in different locales

## Solution Strategy

1. **Database Collation Check**: Verify that both local and production databases have the same collation settings for Cyrillic character support
2. **Character Encoding Verification**: Ensure consistent UTF-8 encoding across all layers
3. **Search Query Modification**: Consider using PostgreSQL's full-text search or specialized collation for Cyrillic text
4. **Environment Configuration Alignment**: Ensure SSL and other connection settings are consistent
5. **Testing**: Implement specific tests for Cyrillic character search in both environments

## Implementation Considerations

- Database collation settings for Cyrillic text search (consider using specific locales like 'ru_RU.UTF-8')
- Character encoding consistency across all layers (API, database, frontend)
- Potential need to modify the ILIKE query to use explicit collation
- Environment configuration alignment for database connections
- Consider using PostgreSQL's unaccent extension or similar for better Cyrillic text matching- Search algorithm configuration
- Environment configuration alignment
- Database collation settings for Cyrillic text search (consider using specific locales like 'ru_RU.UTF-8')
- Character encoding consistency across all layers (API, database, frontend)
- Potential need to modify the ILIKE query to use explicit collation
- Environment configuration alignment for database connections
- Consider using PostgreSQL's unaccent extension or similar for better Cyrillic text matching- Search algorithm configuration
- Environment configuration alignment