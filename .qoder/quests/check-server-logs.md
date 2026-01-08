# Server 502 Bad Gateway Diagnostic Guide

## Quick Fix for Current Issue

Based on your server logs and testing, here's the complete fix process:

### Step 1: Fix Build and Dependencies (✅ COMPLETED)

```bash
# 1. Stop all PM2 processes
cd /var/www/reader.market
pm2 stop all
pm2 delete all

# 2. Clean and reinstall dependencies
rm -rf node_modules
npm install

# 3. Build the application
npm run build

# 4. Verify build output
ls -la dist/
```

### Step 2: Fix Nginx Configuration (✅ COMPLETED)

The Nginx configuration is missing Socket.IO/WebSocket support. Your existing configuration works for static files and API requests, but needs Socket.IO proxy configuration.

**Socket.IO location block has been added successfully.**

### Step 3: Fix PM2 Cluster Mode Issue (🔧 CURRENT - DO THIS NOW)

**Problem:** Socket.IO intermittently fails (200 OK then 400 Bad Request) because PM2 is running 4 cluster instances without sticky sessions. Each instance has isolated memory, so session IDs don't work across instances.

**Solution:**

```bash
# 1. Stop all PM2 processes
pm2 stop all
pm2 delete all

# 2. Edit PM2 configuration
cd /var/www/reader.market
nano ecosystem.config.cjs
```

**Change these lines:**
```javascript
instances: 'max',      // Change this to: instances: 1,
exec_mode: 'cluster',  // Change this to: exec_mode: 'fork',
```

**Or just remove both lines entirely (fork mode with 1 instance is default).**

```bash
# 3. Start PM2 with new configuration
pm2 start ecosystem.config.cjs

# 4. Verify ONLY ONE instance is running
pm2 list
# Should show only 1 ollama-reader instance, not 4

# 5. Save PM2 configuration
pm2 save

# 6. Test Socket.IO
curl -I http://localhost:5001/socket.io/
```

**Verify the fix:**
- Open https://reader.market in browser
- Open developer console
- Socket.IO should connect consistently
- No more intermittent 400 errors
- Real-time features work properly

## Overview

This document provides a systematic approach to diagnosing and resolving a 502 Bad Gateway error that occurs after updating the reader.market application from the repository. The 502 error typically indicates that Nginx cannot connect to the backend Node.js application running on port 5001.

## Problem Context

After updating all code from the repository on the server, accessing reader.market results in a 502 Bad Gateway error. This suggests that while Nginx is running and processing requests, the backend application managed by PM2 is either not running, crashed, or not accessible.

## Identified Root Cause

Based on the PM2 logs analysis and server inspection, multiple issues have been identified and resolved/identified:

### Issue 1: Missing Build Output (RESOLVED)

**Primary Issue:** The application has not been built - the `dist` directory does not exist.

**Evidence from server:**
- Directory listing shows no `dist` folder at `/var/www/reader.market`
- PM2 error shows: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/www/reader.market/dist/index.cjs'`
- PM2 configuration (ecosystem.config.cjs) references: `./dist/index.cjs`
- The application has 25+ restarts, indicating continuous crash-and-restart cycles because it cannot find the entry point

**Resolution:** Install dependencies with `npm install` and build with `npm run build`

### Issue 2: Missing Dependencies (RESOLVED)

**Evidence:** Build fails with "Rollup failed to resolve import 'emoji-picker-react'"

**Resolution:** Clean install with `rm -rf node_modules && npm install`

### Issue 3: Incomplete Nginx Configuration (RESOLVED)

**Primary Issue:** Nginx configuration is missing Socket.IO/WebSocket proxy support.

**Resolution:** Added `/socket.io/` location block with WebSocket headers

### Issue 4: Multiple Conflicting PM2 Processes and Cluster Mode Socket.IO Issues (CURRENT)

**Primary Issue:** Socket.IO requests intermittently fail (200 OK then 400 Bad Request) due to PM2 cluster mode without sticky sessions.

**Evidence from PM2 status:**
- **4 cluster instances** of `ollama-reader` running (PIDs: 2224541, 2224548, 2224555, 2224566)
- Additional `reader-market` process in errored state with 15 restarts
- Socket.IO GET request succeeds (200 OK) but POST request fails (400 Bad Request)
- Intermittent failures indicate requests are being load-balanced to different instances

**Technical Explanation:**
Socket.IO maintains stateful connections with session IDs. When PM2 runs in cluster mode with multiple instances:
1. First request (GET) connects to Instance A and gets session ID `hOYekZmRzQmjSBGRAADJ`
2. Second request (POST) with that session ID gets routed to Instance B
3. Instance B doesn't recognize the session ID → 400 Bad Request

This is a classic Socket.IO + cluster mode issue where session affinity (sticky sessions) is required.

**Symptoms:**
- Socket.IO GET requests succeed (200 OK)
- Socket.IO POST requests with session ID fail (400 Bad Request)
- Pattern repeats intermittently
- Multiple PM2 processes running simultaneously
- One process (reader-market) is errored with 15 restart attempts

**Root Cause:**
PM2 is configured to run in `cluster` mode with `instances: 'max'` (4 CPU cores = 4 instances). Socket.IO requires sticky sessions (session affinity) in cluster mode so that all requests from the same client go to the same worker instance. Without sticky sessions, load balancing distributes requests randomly, causing session ID mismatches.

**Solution:**
Either:
1. **Option A (Recommended):** Switch PM2 to fork mode (single instance) - simpler, suitable for most deployments
2. **Option B (Advanced):** Keep cluster mode but configure Socket.IO with sticky sessions and Redis adapter for shared state

**Secondary Issues:**
- Duplicate PM2 application `reader-market` needs to be removed (errored state, 15 restarts)
- After updating code from repository, the build step was not executed initially

## Diagnostic Strategy

The diagnostic process follows a systematic approach to identify the root cause by examining application status, logs, and service health in the following order:

1. Verify PM2 application status
2. Examine PM2 application logs
3. Check Nginx configuration and logs
4. Verify database connectivity
5. Check service dependencies (PostgreSQL, Ollama)
6. Verify build and deployment integrity

## Immediate Resolution Steps for Current Issue

Based on the identified root cause (missing dist directory), follow these steps to resolve the 502 error:

### Step 1: Stop All PM2 Processes

Stop the conflicting PM2 processes to prevent continuous crash-restart cycles:
```
cd /var/www/reader.market
pm2 stop all
pm2 delete all
```

Verify all processes are stopped:
```
pm2 list
```

The list should be empty.

### Step 2: Verify Node.js and npm Installation

Check that Node.js and npm are properly installed:
```
node --version
npm --version
```

Expected: Node.js v18.x or v20.x (LTS versions)

### Step 3: Install Dependencies

Ensure all dependencies are installed:
```
cd /var/www/reader.market
npm install
```

**Important:** On production servers, you should use `npm install` (not `npm ci --only=production`) when the node_modules directory is missing or incomplete. The error indicates that `emoji-picker-react` and potentially other dependencies are not installed.

If you encounter issues, try cleaning and reinstalling:
```
rm -rf node_modules
npm install
```

Verify critical dependencies are installed:
```
ls node_modules/emoji-picker-react
ls node_modules/react
ls node_modules/vite
```

All these directories should exist.

### Step 4: Build the Application

Create the production build:
```
cd /var/www/reader.market
npm run build
```

This will:
- Compile the client-side code with Vite
- Bundle the server-side code
- Create the `dist` directory with all compiled assets

Expected output: Build process should complete without errors and create the dist directory.

### Step 5: Verify Build Output

Check that the dist directory and entry point were created:
```
ls -la /var/www/reader.market/dist/
ls -la /var/www/reader.market/dist/index.*
```

You should see:
- The `dist` directory exists
- An entry point file (index.cjs, index.mjs, or index.js)
- A `public` directory with compiled frontend assets

### Step 6: Update Ecosystem Configuration (If Needed)

Check what file was created and verify it matches the PM2 configuration:
```
cat /var/www/reader.market/ecosystem.config.cjs | grep script
```

If the build created `index.mjs` but ecosystem.config.cjs references `index.cjs`, update the configuration:
```
nano /var/www/reader.market/ecosystem.config.cjs
```

Change the script line to match the actual file created.

### Step 7: Start PM2 with Correct Configuration

Start only the ollama-reader application:
```
cd /var/www/reader.market
pm2 start ecosystem.config.cjs
pm2 save
```

### Step 8: Verify Application Status

Check that the application is running without restarts:
```
pm2 status
```

Expected:
- Status: online
- Restart count: 0 (or very low)
- Multiple cluster instances if configured

Wait 30 seconds and check again:
```
pm2 status
```

The restart count should remain stable (not increasing).

### Step 9: Check Logs for Errors

Monitor logs to ensure the application started successfully:
```
pm2 logs ollama-reader --lines 30
```

Look for:
- "Server started" or similar success messages
- No error messages
- Application listening on port 5001

### Step 10: Test Application Access

Test the backend directly:
```
curl http://localhost:5001/api/health
```

Expected: 200 OK response (or appropriate response from health endpoint)

Test via Nginx:
```
curl -I https://reader.market
```

Expected: 200 OK or 302/301 redirect (not 502)

### Step 11: Monitor for Stability

Watch the application for a few minutes to ensure it remains stable:
```
pm2 monit
```

Press Ctrl+C to exit monitoring.

### Step 12: Final Verification

Open a web browser and navigate to:
```
https://reader.market
```

The application should load without 502 errors.

## Diagnostic Commands

### Phase 1: Check PM2 Application Status

Check if the Node.js application is running under PM2 management.

**Command:**
```
pm2 status
```

**What to look for:**
- Application name: ollama-reader
- Status should be "online"
- If status is "stopped", "errored", or "one-launch-status", the application has crashed

**Command:**
```
pm2 list
```

**What to look for:**
- Number of restarts (high restart count indicates recurring crashes)
- Uptime (low uptime suggests recent crashes)
- Memory usage (high memory may cause restarts)

### Phase 2: Examine PM2 Application Logs

Review the application logs to identify the specific error causing the failure.

**Command (view recent logs):**
```
pm2 logs ollama-reader --lines 100
```

**Command (view error logs specifically):**
```
pm2 logs ollama-reader --err --lines 50
```

**Command (view logs from file):**
```
tail -n 100 /var/www/reader.market/logs/err.log
```

**Command (view combined logs):**
```
tail -n 100 /var/www/reader.market/logs/combined.log
```

**What to look for:**
- Module not found errors (missing dependencies)
- Database connection errors
- Port binding errors (port 5001 already in use)
- Syntax errors or compilation errors
- Environment variable errors
- File permission errors

### Phase 3: Check Nginx Configuration and Logs

Verify Nginx is properly configured and examine its error logs.

**Command (test configuration):**
```
sudo nginx -t
```

**What to look for:**
- Configuration syntax errors
- Missing SSL certificate errors

**Command (view Nginx error log):**
```
sudo tail -n 50 /var/log/nginx/reader.market.error.log
```

**What to look for:**
- Connection refused to 127.0.0.1:5001 (backend not running)
- Upstream timed out errors
- Permission denied errors

**Command (view Nginx access log):**
```
sudo tail -n 50 /var/log/nginx/reader.market.access.log
```

**Command (check Nginx status):**
```
sudo systemctl status nginx
```

### Phase 4: Verify Database Connectivity

Ensure PostgreSQL is running and the application can connect to the database.

**Command (check PostgreSQL status):**
```
sudo systemctl status postgresql
```

**Command (test database connection):**
```
psql -h localhost -U booksuser -d booksdb -c "SELECT version();"
```

**Note:** Password is "bookspassword" (as configured in ecosystem.config.cjs)

**What to look for:**
- PostgreSQL service not running
- Database does not exist
- User authentication failure
- Connection timeout

### Phase 5: Check Service Dependencies

Verify all required services are running.

**Command (check Ollama service):**
```
sudo systemctl status ollama
```

**Command (test Ollama connectivity):**
```
curl http://localhost:11434/api/version
```

**Command (check if port 5001 is in use):**
```
sudo netstat -tuln | grep :5001
```

**Command (check which process is using port 5001):**
```
sudo lsof -i :5001
```

### Phase 6: Verify Build and Deployment Integrity

Ensure the application was built correctly and all files are present.

**Command (check if dist directory exists):**
```
ls -la /var/www/reader.market/dist/
```

**Command (check if main entry point exists):**
```
ls -la /var/www/reader.market/dist/index.cjs
```

**Command (verify environment file exists):**
```
ls -la /var/www/reader.market/.env
```

**Command (check Node.js version):**
```
node --version
```

**Expected version:** Node.js LTS (v18.x or v20.x)

**Command (verify ecosystem config file):**
```
cat /var/www/reader.market/ecosystem.config.cjs
```

**What to look for:**
- File should use .cjs extension (not .js)
- Script path should be ./dist/index.cjs
- Port should be 5001

## Common Build Errors and Solutions

### Build Error: "Rollup failed to resolve import"

**Error Message:**
```
[vite]: Rollup failed to resolve import "emoji-picker-react" from "/var/www/reader.market/client/src/components/EmojiPicker.tsx".
```

**Cause:**
This error occurs when dependencies are not properly installed. The package `emoji-picker-react` (or other packages) are missing from `node_modules`.

**Solution:**

1. **Remove existing node_modules and reinstall:**
   ```
   cd /var/www/reader.market
   rm -rf node_modules
   npm install
   ```

2. **Verify the package was installed:**
   ```
   ls node_modules/emoji-picker-react
   ```
   You should see the package directory.

3. **Check for installation errors:**
   If npm install shows errors, you may need to:
   ```
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Verify Node.js version:**
   ```
   node --version
   ```
   Should be v18.x or v20.x (LTS)

5. **Retry the build:**
   ```
   npm run build
   ```

### Build Error: "Cannot find module"

**Cause:**
Typically means a TypeScript or Node.js module cannot be found during the build process.

**Solution:**

Ensure all dependencies including devDependencies are installed:
```
cd /var/www/reader.market
npm install
```

Check that critical build tools are present:
```
ls node_modules/vite
ls node_modules/typescript
ls node_modules/tsx
```

### Build Error: Out of Memory

**Error Message:**
```
JavaScript heap out of memory
```

**Solution:**

Increase Node.js memory limit:
```
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

Or modify package.json build script temporarily to include the flag.

## Common Issues and Solutions

### Issue 1: Application Not Built or Mismatched Build Output

**Symptoms:**
- Missing dist directory or index.cjs file
- PM2 logs show "Cannot find module" error
- Error: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/www/reader.market/dist/index.cjs'`
- High restart count in PM2 status

**Diagnostic verification:**
```
ls -la /var/www/reader.market/dist/
ls -la /var/www/reader.market/dist/index.*
cat /var/www/reader.market/ecosystem.config.cjs | grep script
```

**Resolution approach:**

First, identify the mismatch:
```
cd /var/www/reader.market
ls -la dist/index.*
```

If the file exists but with different extension (e.g., index.mjs instead of index.cjs), update ecosystem.config.cjs to match the actual build output.

If no file exists, rebuild:
```
cd /var/www/reader.market
npm run build
ls -la dist/index.*
```

Then update ecosystem.config.cjs script path to match the actual output file, stop all PM2 processes, and restart:
```
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
```

### Issue 2: Missing Dependencies or Incomplete node_modules

**Symptoms:**
- Build fails with "Cannot find module" or "failed to resolve import" errors
- Vite/Rollup reports missing packages like "emoji-picker-react"
- Error: `Rollup failed to resolve import "emoji-picker-react"`
- Application crashes immediately after start

**Diagnostic verification:**
```
ls node_modules/emoji-picker-react
ls node_modules/ | wc -l
npm list --depth=0
```

Check PM2 error logs for module errors:
```
pm2 logs --err --lines 50
```

**Resolution approach:**

Clean installation of all dependencies:
```
cd /var/www/reader.market
rm -rf node_modules
npm install
```

**Do not use `npm ci --only=production`** as it will skip devDependencies that are needed for building (like Vite, TypeScript, etc.).

After installation completes, verify key packages:
```
ls node_modules/emoji-picker-react
ls node_modules/vite
ls node_modules/typescript
```

Then rebuild:
```
npm run build
```

If the build succeeds, restart PM2:
```
pm2 restart ollama-reader
```

### Issue 3: Database Connection Failure

**Symptoms:**
- PM2 logs show "connection refused" or "password authentication failed"
- PostgreSQL not running

**Diagnostic verification:**
```
sudo systemctl status postgresql
psql -h localhost -U booksuser -d booksdb -c "SELECT 1;"
```

**Resolution approach:**
Start PostgreSQL and verify credentials:
```
sudo systemctl start postgresql
```

Check environment variables in .env file match database credentials.

### Issue 4: Port Already in Use

**Symptoms:**
- PM2 logs show "EADDRINUSE" error
- Application cannot bind to port 5001

**Diagnostic verification:**
```
sudo netstat -tuln | grep :5001
sudo lsof -i :5001
```

**Resolution approach:**
Stop the conflicting process or kill old Node.js processes:
```
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.cjs
```

### Issue 5: PM2 Process File Corruption

**Symptoms:**
- PM2 commands hang or fail
- PM2 list shows unexpected behavior

**Resolution approach:**
Reset PM2 process management:
```
pm2 kill
pm2 start ecosystem.config.cjs
pm2 save
```

### Issue 6: Incorrect Ecosystem Config Extension

**Symptoms:**
- PM2 cannot start application
- Error message about "module is not defined"

**Diagnostic verification:**
```
ls -la /var/www/reader.market/ecosystem.config.*
```

**Resolution approach:**
The file must be ecosystem.config.cjs (not .js) because the project uses ESM ("type": "module" in package.json). Verify the file extension and content uses module.exports syntax.

### Issue 7: File Permissions Issues

**Symptoms:**
- PM2 logs show "EACCES" or permission denied errors
- Application cannot write to uploads or logs directory

**Diagnostic verification:**
```
ls -la /var/www/reader.market/
ls -la /var/www/reader.market/uploads/
ls -la /var/www/reader.market/logs/
```

**Resolution approach:**
Correct file permissions:
```
sudo chown -R $USER:$USER /var/www/reader.market
chmod -R 755 /var/www/reader.market
sudo chown -R $USER:www-data /var/www/reader.market/uploads
sudo chmod -R 775 /var/www/reader.market/uploads
```

### Issue 8: Multiple Conflicting PM2 Processes

**Symptoms:**
- Multiple applications with different names running simultaneously (ollama-reader and reader-market)
- High restart counts
- Port conflicts or unpredictable behavior
- PM2 list shows duplicate or unexpected processes

**Diagnostic verification:**
```
pm2 list
ps aux | grep node
sudo netstat -tuln | grep :5001
```

**Resolution approach:**
Clean up all PM2 processes and start fresh:
```
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

Ensure only the intended application (ollama-reader) is running with the correct configuration.

### Issue 9: Nginx Configuration Error

**Symptoms:**
- Nginx test fails
- 502 error even when application is running

**Diagnostic verification:**
```
sudo nginx -t
```

**Resolution approach:**
Reload Nginx configuration:
```
sudo systemctl reload nginx
```

If configuration has errors, review and correct /etc/nginx/sites-available/reader.market

### Issue 10: Socket.IO / WebSocket Failures (400 Bad Request)

**Symptoms:**
- Application loads but real-time features don't work
- Browser console shows Socket.IO errors
- Error: `socket.io/?EIO=4&transport=polling... 400 Bad Request`
- Messaging, notifications, or live updates fail
- WebSocket connection cannot be established

**Diagnostic verification:**
```
# Check current Nginx configuration
sudo cat /etc/nginx/sites-available/reader.market | grep -A 5 "location /"

# Check if it's proxying to Node.js or configured for PHP
sudo cat /etc/nginx/sites-available/reader.market | grep -E "proxy_pass|fastcgi_pass"

# Test Socket.IO endpoint directly
curl -I http://localhost:5001/socket.io/
```

**What to look for:**
- If you see `fastcgi_pass` - configuration is for PHP (WRONG)
- If you see `proxy_pass http://127.0.0.1:5001` - configuration is correct
- Missing WebSocket headers: `Upgrade` and `Connection "upgrade"`

**Resolution approach:**

The Nginx configuration must proxy ALL requests to the Node.js application and include WebSocket support.

1. **Backup current configuration:**
   ```
   sudo cp /etc/nginx/sites-available/reader.market /etc/nginx/sites-available/reader.market.backup.$(date +%Y%m%d)
   ```

2. **Update Nginx configuration:**
   ```
   sudo nano /etc/nginx/sites-available/reader.market
   ```

3. **Ensure these key elements are present:**
   
   - Main location block proxies to Node.js:
     ```nginx
     location / {
         proxy_pass http://127.0.0.1:5001;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "upgrade";
         proxy_buffering off;
     }
     ```
   
   - Dedicated Socket.IO location block:
     ```nginx
     location /socket.io/ {
         proxy_pass http://127.0.0.1:5001;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "upgrade";
         proxy_buffering off;
     }
     ```

4. **Remove any PHP-FPM configuration blocks** (fastcgi_pass, php location blocks)

5. **Test and reload:**
   ```
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **Verify Socket.IO works:**
   - Open browser developer console
   - Navigate to https://reader.market
   - Check for Socket.IO connection success messages
   - No 400 errors should appear

**Root Cause:**
The Nginx configuration was set up for a PHP application using FastCGI, but the reader.market application is a Node.js Express application. Without proper proxy configuration, Nginx cannot forward WebSocket/Socket.IO requests to the Node.js backend, causing 400 Bad Request errors for real-time features.

### Issue 11: PM2 Cluster Mode Causing Intermittent Socket.IO Failures

**Symptoms:**
- Socket.IO requests succeed (200 OK) then fail (400 Bad Request) intermittently
- Pattern: GET request succeeds, POST request with session ID fails
- Error: `POST https://reader.market/socket.io/?EIO=4&transport=polling&t=xxx&sid=xxx 400 Bad Request`
- Real-time features work sporadically
- Multiple PM2 cluster instances running (4 instances visible in `pm2 list`)

**Diagnostic verification:**
```
# Check PM2 instances
pm2 list

# Check ecosystem configuration
cat /var/www/reader.market/ecosystem.config.cjs | grep -E "instances|exec_mode"

# Monitor Socket.IO requests in browser console
# Look for pattern: 200 OK followed by 400 Bad Request
```

**What to look for:**
- Multiple instances of the same application (ollama-reader showing 4 instances)
- `exec_mode: 'cluster'` in ecosystem.config.cjs
- `instances: 'max'` or `instances: <number>` where number > 1
- Socket.IO session IDs in requests that get 400 errors

**Root Cause:**

Socket.IO maintains stateful connections with session IDs. In PM2 cluster mode:
1. Client makes first request → Nginx forwards to Worker Instance A
2. Instance A creates Socket.IO session, returns session ID (e.g., `hOYekZmRzQmjSBGRAADJ`)
3. Client makes second request with that session ID → Nginx load balances to Worker Instance B
4. Instance B doesn't have that session in memory → Returns 400 Bad Request

This is because each PM2 worker has its own isolated memory space. Without sticky sessions (session affinity) or shared state (Redis), Socket.IO sessions cannot work across multiple instances.

**Resolution approach:**

**Option A: Switch to Fork Mode (Recommended for most deployments)**

1. **Stop all PM2 processes:**
   ```
   pm2 stop all
   pm2 delete all
   ```

2. **Edit ecosystem.config.cjs:**
   ```
   nano /var/www/reader.market/ecosystem.config.cjs
   ```

3. **Change from cluster to fork mode:**
   ```javascript
   module.exports = {
     apps: [{
       name: 'ollama-reader',
       script: './dist/index.cjs',
       instances: 1,              // Change from 'max' to 1
       exec_mode: 'fork',         // Change from 'cluster' to 'fork'
       env: {
         NODE_ENV: 'production',
         // ... rest of config
       }
     }]
   };
   ```

4. **Remove duplicate reader-market app if present in config**

5. **Start PM2:**
   ```
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

6. **Verify single instance:**
   ```
   pm2 list
   ```
   Should show only ONE instance of ollama-reader

**Option B: Keep Cluster Mode with Sticky Sessions (Advanced)**

If you need cluster mode for high traffic:

1. **Configure Socket.IO with Redis adapter** (requires Redis server)
2. **Enable sticky sessions in Nginx** using `ip_hash` or `hash` directives
3. **Update application code** to use Redis for shared Socket.IO state

This is more complex and requires additional infrastructure. For most Reader.Market deployments, fork mode is sufficient.

**Why Fork Mode is Recommended:**
- Simpler configuration
- No sticky session complexity
- No shared state management needed
- Suitable for moderate traffic
- One instance can handle thousands of concurrent Socket.IO connections
- Easier to debug and monitor

**When to Use Cluster Mode:**
- High CPU-intensive operations
- Very high traffic (thousands of requests per second)
- Properly configured sticky sessions
- Redis or similar shared state management

## Systematic Troubleshooting Workflow

### Step 1: Quick Status Check
```
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
```

### Step 2: Examine Recent Logs
```
pm2 logs ollama-reader --lines 50
sudo tail -n 30 /var/log/nginx/reader.market.error.log
```

### Step 3: Based on Findings

**If PM2 shows "stopped" or "errored":**
- Check PM2 error logs for the specific error
- Address the error based on common issues above
- Restart the application

**If PM2 shows "online" but 502 persists:**
- Verify application is listening on port 5001
- Check Nginx proxy configuration
- Test direct access to backend: `curl http://localhost:5001/api/health`

**If logs show database errors:**
- Verify PostgreSQL is running
- Test database connection
- Check database credentials in .env

**If logs show module errors:**
- Rebuild application
- Reinstall dependencies
- Verify Node.js version compatibility

### Step 4: Restart Strategy
After fixing issues, restart services in proper order:
```
pm2 restart ollama-reader
sudo systemctl reload nginx
```

### Step 5: Verification
After restart, verify the application is accessible:
```
curl -I https://reader.market
```

Expected response: HTTP/2 200 or 301/302 redirect (not 502)

## Log File Locations

### Application Logs
- Error log: `/var/www/reader.market/logs/err.log`
- Output log: `/var/www/reader.market/logs/out.log`
- Combined log: `/var/www/reader.market/logs/combined.log`

### Nginx Logs
- Access log: `/var/log/nginx/reader.market.access.log`
- Error log: `/var/log/nginx/reader.market.error.log`

### PostgreSQL Logs
- System logs: `/var/log/postgresql/postgresql-*.log`

### PM2 Logs
- View with command: `pm2 logs`
- Or access directly from logs directory above

## Environment Configuration

### Key Configuration Files

**Application directory:** `/var/www/reader.market`

**PM2 configuration:** `/var/www/reader.market/ecosystem.config.cjs`

**Environment variables:** `/var/www/reader.market/.env`

**Nginx site configuration:** `/etc/nginx/sites-available/reader.market`

### Expected Environment Variables

The .env file should contain:
- DATABASE_URL: Connection string to PostgreSQL
- PORT: 5001
- JWT_SECRET: Secret key for authentication
- OLLAMA_HOST: http://localhost:11434
- OLLAMA_MODEL: llama2
- NODE_ENV: production

## Additional Diagnostic Commands

### Check System Resources
```
free -h
df -h
top
```

### Check for Disk Space Issues
```
df -h /var/www/reader.market
df -h /var/log
```

### Check Application Process
```
ps aux | grep node
```

### Check for Zombie Processes
```
ps aux | grep -E 'defunct|Z'
```

### Monitor Real-time Logs
```
pm2 logs --raw
```

### Check System Logs
```
sudo journalctl -u ollama -n 50
sudo journalctl -u nginx -n 50
sudo journalctl -u postgresql -n 50
```

## Recovery Procedure

If all diagnostic attempts fail, perform a complete application restart:

### Step 1: Stop All Services
```
pm2 stop all
pm2 delete all
```

### Step 2: Navigate to Application Directory
```
cd /var/www/reader.market
```

### Step 3: Verify Build Exists
```
ls -la dist/index.cjs
```

### Step 4: Rebuild if Necessary
```
npm run build
```

### Step 5: Start Application
```
pm2 start ecosystem.config.cjs
pm2 save
```

### Step 6: Verify Status
```
pm2 status
pm2 logs --lines 20
```

### Step 7: Test Application
```
curl http://localhost:5001/api/health
```

### Step 8: Reload Nginx
```
sudo systemctl reload nginx
```

### Step 9: Verify External Access
```
curl -I https://reader.market
```

## Monitoring and Prevention

### Proper Deployment Workflow

To prevent the 502 error after code updates, always follow this deployment workflow:

#### Standard Deployment Process

1. **Navigate to application directory:**
   ```
   cd /var/www/reader.market
   ```

2. **Pull latest code from repository:**
   ```
   git pull origin main
   ```
   Or if using a specific branch:
   ```
   git pull origin <branch-name>
   ```

3. **Install/update dependencies:**
   ```
   npm install
   ```
   
   **Important:** Use `npm install` (not `npm ci --only=production`) because devDependencies are required for the build process (Vite, TypeScript, etc.).
   
   If you have node_modules already and want a clean install:
   ```
   rm -rf node_modules
   npm install
   ```

4. **Build the application (CRITICAL STEP):**
   ```
   npm run build
   ```
   **This step is mandatory and was missing in the failed deployment.**

5. **Verify build output:**
   ```
   ls -la dist/
   ```
   Ensure the dist directory exists with compiled files.

6. **Restart PM2 application:**
   ```
   pm2 restart ollama-reader
   ```
   Or if starting fresh:
   ```
   pm2 stop all
   pm2 delete all
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

7. **Verify application status:**
   ```
   pm2 status
   pm2 logs --lines 20
   ```

8. **Test the application:**
   ```
   curl http://localhost:5001/api/health
   curl -I https://reader.market
   ```

#### Automated Deployment Script

The project includes a deployment script at `/var/www/reader.market/deploy.sh` that should automate these steps. To use it:

```
cd /var/www/reader.market
./deploy.sh
```

If the script doesn't exist or needs to be recreated, create it with the proper steps outlined above.

### Regular Monitoring Commands

**Check application health:**
```
pm2 status
pm2 monit
```

**Check logs for errors:**
```
pm2 logs --err --lines 20
```

**Check system resources:**
```
free -h
df -h
```

### Preventive Measures

1. Before updating code, create a backup
2. After pulling updates, always rebuild the application
3. Restart PM2 after code changes
4. Monitor logs during and after deployment
5. Test the application locally before deploying to production
6. Keep dependencies up to date
7. Regularly check for security updates

### Backup Before Changes

Before major updates:
```
cd /var/www
sudo tar -czf reader.market.backup.$(date +%Y%m%d_%H%M%S).tar.gz reader.market/
```

## Post-Deployment Checklist

After resolving all issues and getting the application fully functional:

### Build and PM2
- [ ] Verify dist directory exists at `/var/www/reader.market/dist/`
- [ ] Verify build entry point exists (index.cjs, index.mjs, or index.js)
- [ ] Verify PM2 status shows "online" with stable restart count (0 restarts)
- [ ] Check PM2 logs show no errors: `pm2 logs --lines 30`
- [ ] Verify only one PM2 application is running (not multiple conflicting processes)
- [ ] Save PM2 configuration: `pm2 save`

### Nginx Configuration
- [ ] Verify Nginx configuration is valid: `sudo nginx -t`
- [ ] Confirm Nginx is proxying to Node.js (not PHP): `sudo cat /etc/nginx/sites-available/reader.market | grep proxy_pass`
- [ ] Verify WebSocket headers are configured: `sudo cat /etc/nginx/sites-available/reader.market | grep -i upgrade`
- [ ] Check Nginx error logs have no issues: `sudo tail -20 /var/log/nginx/reader.market.error.log`

### Application Functionality
- [ ] Test frontend loads in browser: `https://reader.market`
- [ ] Test API endpoints respond correctly: `curl http://localhost:5001/api/health`
- [ ] Verify Socket.IO connection works (check browser console, no 400 errors)
- [ ] Test real-time features: messaging, notifications, live updates
- [ ] Verify database connectivity: Check that data loads correctly
- [ ] Test user authentication and login
- [ ] Verify file uploads work
- [ ] Test book reading features

### Services Status
- [ ] Check Ollama service is running: `sudo systemctl status ollama`
- [ ] Verify PostgreSQL is running: `sudo systemctl status postgresql`
- [ ] Verify Nginx is running: `sudo systemctl status nginx`
- [ ] Check all services start on boot

### Monitoring
- [ ] Monitor PM2 logs for any errors: `pm2 logs --lines 20`
- [ ] Check system resources: `free -h` and `df -h`
- [ ] Verify no high CPU or memory usage: `pm2 monit`
- [ ] Document the deployment process for future reference
- [ ] Create a deployment checklist based on this experience

## Reference Information

### Service Management Commands

**PM2:**
- Start: `pm2 start ecosystem.config.cjs`
- Stop: `pm2 stop ollama-reader`
- Restart: `pm2 restart ollama-reader`
- Reload: `pm2 reload ollama-reader`
- Delete: `pm2 delete ollama-reader`

**Nginx:**
- Start: `sudo systemctl start nginx`
- Stop: `sudo systemctl stop nginx`
- Restart: `sudo systemctl restart nginx`
- Reload: `sudo systemctl reload nginx`
- Status: `sudo systemctl status nginx`

**PostgreSQL:**
- Start: `sudo systemctl start postgresql`
- Stop: `sudo systemctl stop postgresql`
- Restart: `sudo systemctl restart postgresql`
- Status: `sudo systemctl status postgresql`

**Ollama:**
- Start: `sudo systemctl start ollama`
- Stop: `sudo systemctl stop ollama`
- Restart: `sudo systemctl restart ollama`
- Status: `sudo systemctl status ollama`

### Application Configuration

**Port:** 5001
**Database:** booksdb
**Database User:** booksuser
**Application Name (PM2):** ollama-reader
**Domain:** reader.market
**Application Path:** /var/www/reader.market
**Entry Point:** dist/index.cjs

## Expected Behavior After Resolution

Once the issue is resolved:

1. PM2 status shows ollama-reader as "online"
2. PM2 logs show application started successfully
3. Application listens on port 5001
4. Nginx successfully proxies requests to the backend
5. Visiting https://reader.market shows the application interface
6. No 502 errors in browser or Nginx logs
7. API endpoints respond with appropriate data
8. Database queries execute successfully
- Stop: `sudo systemctl stop ollama`
- Restart: `sudo systemctl restart ollama`
- Status: `sudo systemctl status ollama`

### Application Configuration

**Port:** 5001
**Database:** booksdb
**Database User:** booksuser
**Application Name (PM2):** ollama-reader
**Domain:** reader.market
**Application Path:** /var/www/reader.market
**Entry Point:** dist/index.cjs

## Expected Behavior After Resolution

Once the issue is resolved:

1. PM2 status shows ollama-reader as "online"
2. PM2 logs show application started successfully
3. Application listens on port 5001
4. Nginx successfully proxies requests to the backend
5. Visiting https://reader.market shows the application interface
6. No 502 errors in browser or Nginx logs
7. API endpoints respond with appropriate data
8. Database queries execute successfully
**Ollama:**
- Start: `sudo systemctl start ollama`
- Stop: `sudo systemctl stop ollama`
- Restart: `sudo systemctl restart ollama`
- Status: `sudo systemctl status ollama`

### Application Configuration

**Port:** 5001
**Database:** booksdb
**Database User:** booksuser
**Application Name (PM2):** ollama-reader
**Domain:** reader.market
**Application Path:** /var/www/reader.market
**Entry Point:** dist/index.cjs

## Expected Behavior After Resolution

Once the issue is resolved:

1. PM2 status shows ollama-reader as "online"
2. PM2 logs show application started successfully
3. Application listens on port 5001
4. Nginx successfully proxies requests to the backend
5. Visiting https://reader.market shows the application interface
6. No 502 errors in browser or Nginx logs
7. API endpoints respond with appropriate data
8. Database queries execute successfully
