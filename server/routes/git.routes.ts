import { Router, type Express } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
    
    // Validate SHA format (can be short Git hash 7+ chars or full 40-char SHA)
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
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
    const { template = 'html', count = '50', cache = 'true' } = req.query;
    
    console.log(`Git history endpoint called - template: ${template}, count: ${count}, cache: ${cache}`);
    
    // Check if caching is disabled
    if (cache === 'false' || cache === '0' || cache === 'false') {
      console.log('Cache disabled for git-history, clearing commits cache');
      commitsCache.data = [];
      commitsCache.timestamp = 0;
    }
    
    // Check if we have cached data and caching is enabled
    const now = Date.now();
    if (cache !== 'false' && commitsCache.data.length > 0 && 
        (now - commitsCache.timestamp) < commitsCache.ttl) {
      console.log(`Using cached commits data for git-history. Cache age: ${Math.floor((now - commitsCache.timestamp) / 1000)} seconds`);
      
      // Return only requested count if specified
      const countNum = parseInt(count as string) || 50;
      const limitedData = commitsCache.data.slice(0, countNum);
      
      // Generate HTML response compatible with client-side parsing
      const htmlResponse = generateHtmlResponse(limitedData);
      res.setHeader('Content-Type', 'text/html');
      return res.send(htmlResponse);
    }
    
    console.log('Fetching fresh git log data for git-history...');
    
    // Execute git log command to get commits from the past year
    // Use --since to get all commits from 1 year ago
    // Use --date=format:"%d.%m.%Y, %H:%M" to get date in DD.MM.YYYY, HH:MM format
    const { stdout } = await execAsync(`git log --oneline --pretty=format:"%h||%an||%ad||%s" --date=format:"%d.%m.%Y, %H:%M" --since="1 year ago"`, {
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    
    const lines = stdout.trim().split('\n').filter((line: string) => line.trim() !== '');
    
    const commits = lines.map((line: string) => {
      const [hash, author, date, ...messageParts] = line.split('||');
      return {
        hash: hash?.trim(),
        author: author?.trim(),
        date: date?.trim(),
        message: messageParts.join('||')?.trim()
      };
    }).filter((commit: any) => commit.hash);
    
    console.log(`Fetched ${commits.length} commits from git for git-history`);
    
    // Cache the data
    commitsCache.data = commits;
    commitsCache.timestamp = now;
    
    // Generate HTML response compatible with client-side parsing
    const htmlResponse = generateHtmlResponse(commits);
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlResponse);
    
  } catch (error) {
    console.error('Error in git-history endpoint:', error);
    const errorHtml = `<!DOCTYPE html><html><body><div class="error">Failed to fetch git history: ${(error as Error).message}</div></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(errorHtml);
  }
});

  // Git to GPT endpoint - generates GPT-friendly format from git history
  router.get("/git-to-gpt", async (req, res) => {
    console.log("=== GIT-TO-GPT ENDPOINT CALLED ===");
    console.log("Query params:", req.query);
    
    try {
      const { template = 'html', count = '50', cache = 'true' } = req.query;
      
      console.log(`Parameters - template: ${template}, count: ${count}, cache: ${cache}`);
      
      // Check if caching is disabled
      if (cache === 'false' || cache === '0' || cache === 'false') {
        console.log('Cache disabled, clearing commits cache');
        commitsCache.data = [];
        commitsCache.timestamp = 0;
      }
      
      // Check if we have cached data and caching is enabled
      const now = Date.now();
      if (cache !== 'false' && commitsCache.data.length > 0 && 
          (now - commitsCache.timestamp) < commitsCache.ttl) {
        console.log(`Using cached commits data. Cache age: ${Math.floor((now - commitsCache.timestamp) / 1000)} seconds`);
        
        // Return only requested count if specified
        const countNum = parseInt(count as string) || 50;
        const limitedData = commitsCache.data.slice(0, countNum);
        
        return res.json({
          commits: limitedData,
          count: limitedData.length,
          cached: true,
          cache_age_seconds: Math.floor((now - commitsCache.timestamp) / 1000)
        });
      }
      
      console.log('Fetching fresh git log data...');
      
      // Execute git log command to get recent commits
      const countNum = parseInt(count as string) || 50;
      
      const { stdout } = await execAsync(`git log --oneline --pretty=format:"%h||%an||%ad||%s" -${countNum}`, {
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      const lines = stdout.trim().split('\n').filter((line: string) => line.trim() !== '');
      
      const commits = lines.map((line: string) => {
        const [hash, author, date, ...messageParts] = line.split('||');
        return {
          hash: hash?.trim(),
          author: author?.trim(),
          date: date?.trim(),
          message: messageParts.join('||')?.trim()
        };
      }).filter((commit: any) => commit.hash);
      
      console.log(`Fetched ${commits.length} commits from git`);
      
      // Cache the data
      commitsCache.data = commits;
      commitsCache.timestamp = now;
      
      // Format response according to template
      let responseData;
      
      switch(template) {
        case 'cool':
          responseData = {
            commits: commits.map((commit: any) => ({
              id: commit.hash,
              title: commit.message,
              author: commit.author,
              date: commit.date,
              type: 'git-commit'
            })),
            summary: {
              total: commits.length,
              period: 'recent',
              format: 'cool-template'
            }
          };
          break;
          
        case 'html':
          responseData = {
            html: `<div class="git-commits">
              <h3>Recent Commits (${commits.length})</h3>
              <ul>
                ${commits.map((commit: any) => `
                  <li>
                    <strong>${commit.hash}</strong>: ${commit.message} 
                    <em>by ${commit.author}</em> 
                    <small>(${commit.date})</small>
                  </li>`).join('')}
              </ul>
            </div>`
          };
          break;
          
        default:
          responseData = {
            commits,
            count: commits.length,
            template: template as string
          };
      }
      
      res.json(responseData);
      
    } catch (error) {
      console.error('Error in git-to-gpt endpoint:', error);
      res.status(500).json({
        error: 'Failed to fetch git commits',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  
  // Helper function to generate HTML response compatible with client-side parsing
  function generateHtmlResponse(commits: any[]) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Git Commits</title>
</head>
<body>
  <!-- Cache updated: ${new Date().toISOString()} -->
  <div class="commits-container">
    ${commits.map((commit: any) => `
    <div class="commit-card">
      <div class="commit-hash">${escapeHtml(commit.hash || '')}</div>
      <div class="commit-message">${escapeHtml(commit.message || '')}</div>
      <div class="author-name">${escapeHtml(commit.author || '')}</div>
      <div class="commit-date">${escapeHtml(commit.date || '')}</div>
      <div class="commit-body"></div>
      <a class="commit-link" href="https://github.com/WizardJIOCb/Reader.Market/commit/${escapeHtml(commit.hash || '')}">${escapeHtml(commit.hash || '')}</a>
    </div>`).join('')}
  </div>
</body>
</html>`;
    return html;
  }
  
  // Helper function to escape HTML
  function escapeHtml(text: string): string {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  return router;
}