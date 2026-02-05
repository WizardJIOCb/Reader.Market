import { Router, type Express } from 'express';

export function createGitRouter() {
  const router = Router();

// In-memory cache for GitHub commits
const commitsCache = {
  data: [] as any[],
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 minutes TTL
};

// In-memory cache for individual commit details
const commitDetailsCache = {
  data: new Map<string, { details: any, timestamp: number }>(),
  ttl: 10 * 60 * 1000 // 10 minutes TTL
};

// Cache for API git history endpoint
const apiGitCache = {
  data: null as any,
  timestamp: 0,
  ttl: 2 * 60 * 1000 // 2 minutes TTL
};

console.log('Initialized empty commits cache');

// Batch commit details endpoint - get details for multiple commits in one request
router.post("/commits/details/batch", async (req, res) => {
  console.log("=== BATCH COMMIT DETAILS ENDPOINT CALLED ===");
  console.log("Requested SHAs:", req.body.shas);
  
  try {
    const { shas } = req.body;
    
    if (!Array.isArray(shas) || shas.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'SHAs array is required'
      });
    }
    
    // Validate all SHAs
    const invalidShas = shas.filter((sha: string) => !/^[0-9a-f]{40}$/i.test(sha));
    if (invalidShas.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid commit SHA format: ${invalidShas.join(', ')}`
      });
    }
    
    // Limit batch size to prevent abuse
    if (shas.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 commits per request'
      });
    }
    
    // Check GitHub rate limit before processing
    const rateLimitResponse = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'User-Agent': 'reader.market-app/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (rateLimitResponse.ok) {
      const rateLimitData = await rateLimitResponse.json();
      const coreLimit = rateLimitData.resources.core;
      
      console.log(`GitHub Rate Limit - Remaining: ${coreLimit.remaining}/${coreLimit.limit}`);
      
      // If we don't have enough requests for all commits, return error
      if (coreLimit.remaining < shas.length + 5) { // +5 buffer
        console.warn('Not enough GitHub requests remaining for batch');
        return res.status(429).json({
          success: false,
          error: 'GitHub API rate limit would be exceeded. Please try again later.',
          rate_limit_remaining: coreLimit.remaining
        });
      }
    }
    
    // Process commits with caching
    const now = Date.now();
    const results: Record<string, any> = {};
    const fetchPromises: Promise<void>[] = [];
    
    for (const sha of shas) {
      // Check cache first
      const cachedEntry = commitDetailsCache.data.get(sha);
      if (cachedEntry && (now - cachedEntry.timestamp) < commitDetailsCache.ttl) {
        console.log(`Using cached data for commit ${sha.substring(0, 7)}`);
        results[sha] = {
          success: true,
          commit: cachedEntry.details,
          cache_hit: true,
          cache_age_seconds: Math.floor((now - cachedEntry.timestamp) / 1000)
        };
        continue;
      }
      
      // Add small delay between requests to be respectful to GitHub
      const delay = fetchPromises.length * 50; // 50ms between requests
      
      const fetchPromise = new Promise<void>(resolve => {
        setTimeout(async () => {
          try {
            const apiUrl = `https://api.github.com/repos/WizardJIOCb/Reader.Market/commits/${sha}`;
            console.log(`Fetching commit details from: ${apiUrl}`);
            
            const githubHeaders: Record<string, string> = {
              'User-Agent': 'reader.market-app/1.0',
              'Accept': 'application/vnd.github.v3+json'
            };
                    
            // Add GitHub token if available
            if (process.env.GITHUB_TOKEN) {
              githubHeaders['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
            }
                    
            const response = await fetch(apiUrl, {
              headers: githubHeaders
            });
            
            if (!response.ok) {
              if (response.status === 404) {
                results[sha] = {
                  success: false,
                  error: 'Commit not found'
                };
              } else {
                results[sha] = {
                  success: false,
                  error: `GitHub API error: ${response.status}`
                };
              }
              resolve();
              return;
            }
            
            const commitData = await response.json();
            
            // Transform the response
            const commitResult = {
              sha: commitData.sha,
              message: commitData.commit.message,
              author: {
                name: commitData.commit.author.name,
                email: commitData.commit.author.email,
                date: commitData.commit.author.date
              },
              committer: {
                name: commitData.commit.committer.name,
                email: commitData.commit.committer.email,
                date: commitData.commit.committer.date
              },
              url: commitData.html_url,
              stats: {
                additions: commitData.stats?.additions || 0,
                deletions: commitData.stats?.deletions || 0,
                total: commitData.stats?.total || 0
              },
              files: (commitData.files || []).map((file: any) => ({
                filename: file.filename,
                status: file.status,
                additions: file.additions || 0,
                deletions: file.deletions || 0,
                changes: file.changes || 0,
                blob_url: file.blob_url,
                raw_url: file.raw_url,
                patch: file.patch
              }))
            };
            
            // Cache the result
            commitDetailsCache.data.set(sha, {
              details: commitResult,
              timestamp: now
            });
            
            results[sha] = {
              success: true,
              commit: commitResult,
              cache_hit: false
            };
            
            console.log(`Successfully fetched and cached details for commit ${sha.substring(0, 7)}`);
            
          } catch (error) {
            console.error(`Error fetching commit ${sha.substring(0, 7)}:`, error);
            results[sha] = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
          resolve();
        }, delay);
      });
      
      fetchPromises.push(fetchPromise);
    }
    
    // Wait for all requests to complete
    await Promise.all(fetchPromises);
    
    res.json({
      success: true,
      commits: results
    });
    
  } catch (error) {
    console.error('Error in batch commit details endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commit details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Git commit details endpoint - get changed files and stats
router.get("/commit/:sha/details", async (req, res) => {
  console.log("=== COMMIT DETAILS ENDPOINT CALLED ===");
  console.log("Commit SHA:", req.params.sha);
  
  try {
    const { sha } = req.params;
    
    if (!sha) {
      return res.status(400).json({
        success: false,
        error: 'Commit SHA is required'
      });
    }
    
    // Validate SHA format (should be 40 characters hex)
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid commit SHA format'
      });
    }
    
    // Check if we have cached data for this commit
    const now = Date.now();
    const cachedEntry = commitDetailsCache.data.get(sha);
    
    if (cachedEntry && (now - cachedEntry.timestamp) < commitDetailsCache.ttl) {
      console.log(`Returning cached commit details for ${sha.substring(0, 7)}`);
      console.log(`Cache age: ${Math.floor((now - cachedEntry.timestamp) / 1000)} seconds`);
      
      return res.json({
        success: true,
        commit: cachedEntry.details,
        cache_hit: true,
        cache_age_seconds: Math.floor((now - cachedEntry.timestamp) / 1000)
      });
    }
    
    // Check GitHub rate limit headers before making request
    const rateLimitHeaders: Record<string, string> = {
      'User-Agent': 'reader.market-app/1.0',
      'Accept': 'application/vnd.github.v3+json'
    };
    
    // Add GitHub token if available
    if (process.env.GITHUB_TOKEN) {
      rateLimitHeaders['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    const rateLimitResponse = await fetch('https://api.github.com/rate_limit', {
      headers: rateLimitHeaders
    });
    
    if (rateLimitResponse.ok) {
      const rateLimitData = await rateLimitResponse.json();
      const coreLimit = rateLimitData.resources.core;
      
      console.log(`GitHub Rate Limit - Remaining: ${coreLimit.remaining}/${coreLimit.limit}`);
      
      // If we're close to the limit, return cached data or error
      if (coreLimit.remaining < 10) {
        console.warn('GitHub rate limit is low, returning error');
        return res.status(429).json({
          success: false,
          error: 'GitHub API rate limit exceeded. Please try again later.',
          rate_limit_remaining: coreLimit.remaining
        });
      }
    }
    
    const apiUrl = `https://api.github.com/repos/WizardJIOCb/Reader.Market/commits/${sha}`;
    console.log(`Fetching commit details from: ${apiUrl}`);
    
    // Fetch from GitHub API
    const githubHeaders: Record<string, string> = {
      'User-Agent': 'reader.market-app/1.0',
      'Accept': 'application/vnd.github.v3+json'
    };
    
    // Add GitHub token if available
    if (process.env.GITHUB_TOKEN) {
      githubHeaders['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(apiUrl, {
      headers: githubHeaders
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Commit not found'
        });
      }
      throw new Error(`GitHub API responded with status ${response.status}`);
    }
    
    const commitData = await response.json();
    
    // Transform the response to include file changes
    const result = {
      success: true,
      commit: {
        sha: commitData.sha,
        message: commitData.commit.message,
        author: {
          name: commitData.commit.author.name,
          email: commitData.commit.author.email,
          date: commitData.commit.author.date
        },
        committer: {
          name: commitData.commit.committer.name,
          email: commitData.commit.committer.email,
          date: commitData.commit.committer.date
        },
        url: commitData.html_url,
        stats: {
          additions: commitData.stats?.additions || 0,
          deletions: commitData.stats?.deletions || 0,
          total: commitData.stats?.total || 0
        },
        files: (commitData.files || []).map((file: any) => ({
          filename: file.filename,
          status: file.status, // added, modified, removed
          additions: file.additions || 0,
          deletions: file.deletions || 0,
          changes: file.changes || 0,
          blob_url: file.blob_url,
          raw_url: file.raw_url,
          patch: file.patch // The actual diff content
        }))
      }
    };
    
    // Cache the result
    commitDetailsCache.data.set(sha, {
      details: result.commit,
      timestamp: now
    });
    
    console.log(`Successfully fetched and cached details for commit ${sha.substring(0, 7)}`);
    console.log(`Files changed: ${result.commit.files.length}`);
    console.log(`Additions: ${result.commit.stats.additions}, Deletions: ${result.commit.stats.deletions}`);
    
    res.json({
      ...result,
      cache_hit: false
    });
    
  } catch (error) {
    console.error('Error fetching commit details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commit details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Git history endpoint
router.get("/git-history", async (req, res) => {
  try {
    const { search, limit = 50, offset = 0, author } = req.query;

    // Check if we have cached data and it's still fresh
    const now = Date.now();
    if (apiGitCache.data && (now - apiGitCache.timestamp) < apiGitCache.ttl) {
      console.log(`Using cached API git history. Cache age: ${Math.floor((now - apiGitCache.timestamp) / 1000)} seconds`);
      
      // Apply pagination to cached data
      const startIndex = parseInt(offset as string) || 0;
      const limitNum = parseInt(limit as string) || 50;
      const paginatedData = apiGitCache.data.commits.slice(startIndex, startIndex + limitNum);
      
      return res.json({
        ...apiGitCache.data,
        commits: paginatedData,
        pagination: {
          total: apiGitCache.data.commits.length,
          limit: limitNum,
          offset: startIndex,
          hasMore: startIndex + limitNum < apiGitCache.data.commits.length
        }
      });
    }

    // Forward to the main git-to-gpt endpoint
    const currentTime = Date.now();
    const template = 'html';
    const count = 100; // Get more commits to have enough for pagination
    
    const response = await fetch(`http://localhost:5001/git-to-gpt?template=${template}&count=${count}`);
    const data = await response.json();

    if (data.error) {
      console.error('Error fetching git history from git-to-gpt:', data.error);
      return res.status(500).json(data);
    }

    // Apply filters to the data
    let filteredCommits = data.commits;

    if (search && typeof search === 'string') {
      filteredCommits = filteredCommits.filter((commit: any) => 
        commit.message.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (author && typeof author === 'string') {
      filteredCommits = filteredCommits.filter((commit: any) => 
        commit.author.toLowerCase().includes(author.toLowerCase())
      );
    }

    // Apply pagination
    const startIndex = parseInt(offset as string) || 0;
    const limitNum = parseInt(limit as string) || 50;
    const paginatedData = filteredCommits.slice(startIndex, startIndex + limitNum);

    const result = {
      commits: paginatedData,
      pagination: {
        total: filteredCommits.length,
        limit: limitNum,
        offset: startIndex,
        hasMore: startIndex + limitNum < filteredCommits.length
      }
    };

    // Cache the result
    apiGitCache.data = { commits: filteredCommits }; // Cache full filtered data
    apiGitCache.timestamp = now;
    console.log('Cached API git history response');

    res.json(result);
  } catch (error) {
    console.error('Error in API git history endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch commit history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

  return router;
}