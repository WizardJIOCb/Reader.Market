# Socket.IO Production Connection Issue - Investigation and Resolution Design

## Problem Statement

The production server (reader.market) is experiencing Socket.IO connection failures with the following error:

```
POST https://reader.market/socket.io/?EIO=4&transport=polling&t=lttdh0t9&sid=BmYOhtKSZmoNCxqCAABO 400 Bad Request
```

This indicates that Socket.IO polling transport requests are being rejected with "Session ID unknown" errors, preventing real-time features from functioning properly (messaging, notifications, activity streams, typing indicators, etc.).

### Environment Context
- **Application Server**: Node.js with Express and Socket.IO
- **Process Manager**: PM2 in cluster mode (`exec_mode: 'cluster'`, `instances: 'max'`)
- **Reverse Proxy**: Nginx with proper WebSocket configuration
- **Deployment**: Behind Cloudflare CDN with SSL

## Current System Architecture

### Technology Stack
- **Backend**: Node.js with Express, Socket.IO for WebSocket communication
- **Frontend**: Vite + React, Socket.IO client
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy)
- **Database**: PostgreSQL
- **Deployment**: Behind Cloudflare CDN

### Socket.IO Implementation

#### Server Configuration
- Socket.IO server initialized with HTTP server in `server/routes.ts`
- CORS configured to allow all origins with credentials
- Authentication middleware allows both authenticated and guest connections
- Multiple rooms for different features:
  - `user:{userId}` - personal notification rooms
  - `conversation:{conversationId}` - message rooms
  - `stream:global` - global activity feed
  - `stream:personal` - personal activity feed
  - `stream:shelves` - shelf-specific activities

#### Client Configuration
- Socket.IO client connects to root path `/`
- Reconnection enabled with exponential backoff (1s to 5s)
- Maximum 5 reconnection attempts
- Authentication via JWT token in handshake

#### Current Nginx Configuration
The production Nginx configuration includes:
- ✓ Proper proxy pass to Node.js backend (127.0.0.1:5001)
- ✓ WebSocket upgrade headers for Socket.IO
- ✓ Appropriate timeout settings (300s)
- ✓ Cloudflare real IP restoration
- ✓ SSL/TLS configuration with Let's Encrypt

The Nginx configuration is correctly set up and is NOT the source of the problem.

## Root Cause Analysis

### Primary Issue: PM2 Cluster Mode Without Sticky Sessions

#### 1. PM2 Cluster Mode Configuration
The application is running in PM2 cluster mode with the following settings:
- `exec_mode: 'cluster'`
- `instances: 'max'` (spawns multiple worker processes)
- Each worker process runs on port 5001
- No sticky session configuration
- No Socket.IO cluster adapter installed

#### 2. Socket.IO Session Affinity Requirements
Socket.IO with HTTP long-polling requires that all requests from the same session reach the same worker process:

**How Socket.IO Polling Works:**
1. Client makes initial connection request → Worker A assigns session ID
2. Client makes subsequent polling request with session ID → May reach Worker B
3. Worker B doesn't recognize the session ID → Returns "400 Bad Request: Session ID unknown"

**The Problem:**
- Nginx load balances requests across multiple PM2 workers
- Without sticky sessions, sequential requests from the same client can reach different workers
- Each worker maintains its own Socket.IO session state
- Session IDs from Worker A are unknown to Worker B/C/D

#### 3. Why WebSocket Connections May Also Fail
Even if WebSocket upgrade succeeds:
- Initial handshake might reach Worker A
- Upgrade request might reach Worker B
- Mismatched session context causes connection failure

#### 4. PM2 Cluster Mode Trade-offs
**Benefits:**
- Utilizes all CPU cores for improved performance
- Automatic process restart on crashes
- Zero-downtime reloads

**Socket.IO Challenges:**
- Each worker has isolated memory/state
- Socket.IO sessions are not shared between workers
- Requires additional configuration for multi-process support

## Solution Design

### Solution Comparison Matrix

| Solution | Complexity | Performance | Production-Ready | Recommendation |
|----------|-----------|-------------|------------------|----------------|
| **Option 1**: Switch to fork mode | Low | Lower | ✓ Yes | ⭐ Best for quick fix |
| **Option 2**: Nginx sticky sessions | Medium | High | ✓ Yes | ⭐ Best for keeping cluster |
| **Option 3**: @socket.io/pm2 package | High | Highest | ⚠️ Beta | Consider for future |
| **Option 4**: Redis adapter | High | High | ✓ Yes | Enterprise solution |
| **Option 5**: WebSocket-only transport | Medium | High | ⚠️ Limited fallback | Not recommended |

### Recommended Approach: Two-Phase Strategy

**Phase 1 (Immediate Fix)**: Switch PM2 to fork mode to restore functionality quickly

**Phase 2 (Performance Optimization)**: Implement Nginx sticky sessions to re-enable cluster mode

---

## Phase 1: Switch PM2 to Fork Mode (Immediate Fix)

### Objectives
- Restore Socket.IO functionality immediately
- Run single Node.js process without load balancing
- Eliminate session affinity issues
- Maintain current Nginx configuration

### Implementation Strategy

#### PM2 Configuration Changes
Modify `ecosystem.config.cjs` to run in fork mode:
- Change `exec_mode` from `'cluster'` to `'fork'`
- Set `instances` to `1` (single process)
- Keep all other settings unchanged

#### Trade-offs
**Advantages:**
- Immediate resolution of Socket.IO errors
- No Nginx configuration changes required
- Simple rollback if issues occur
- All Socket.IO state in single process

**Disadvantages:**
- Only uses single CPU core
- Lower concurrent request handling
- No automatic load distribution
- Less fault tolerance (single point of failure)

#### When Fork Mode is Sufficient
- Traffic is moderate (< 1000 concurrent connections)
- Server has sufficient single-core performance
- Application is I/O-bound rather than CPU-bound
- Vertical scaling is available if needed

---

## Phase 2: Enable Nginx Sticky Sessions (Performance Optimization)

### Objectives
- Re-enable PM2 cluster mode for better performance
- Configure Nginx to route clients to same worker
- Maintain Socket.IO session affinity
- Utilize all CPU cores

### Implementation Strategy

#### Option 2A: IP Hash Load Balancing
**Method**: Route clients based on source IP address

**Configuration Approach:**
- Define upstream block with multiple PM2 workers
- Use `ip_hash` directive for sticky routing
- Bind each PM2 instance to different port

**Advantages:**
- Simple configuration
- No cookies required
- Works with all transport types

**Disadvantages:**
- Clients behind same NAT/proxy routed to same worker
- Cloudflare IP forwarding must work correctly
- Uneven load distribution in some scenarios

#### Option 2B: Cookie-Based Routing (Recommended)
**Method**: Route clients based on session cookie

**Configuration Approach:**
- Use `hash` directive with cookie value
- More granular client distribution
- Better load balancing than IP-based

**Advantages:**
- Per-client routing regardless of IP
- Better distribution across workers
- Works behind proxies/NAT

**Disadvantages:**
- Slightly more complex configuration
- Requires cookie support (universally available)

#### PM2 Multi-Port Configuration
To use upstream load balancing, each PM2 instance needs unique port:
- Worker 1: Port 5001
- Worker 2: Port 5002  
- Worker 3: Port 5003
- Worker 4: Port 5004

OR use PM2's built-in port incrementing

---

## Phase 3: Alternative Solutions (Advanced)

### Option 3: @socket.io/pm2 Package

#### Overview
Official Socket.IO package that replaces standard PM2 and handles sticky sessions automatically.

#### Implementation Requirements
- Install `@socket.io/pm2` globally
- Install `@socket.io/cluster-adapter` and `@socket.io/sticky` packages
- Modify server code to use cluster adapter
- Update worker setup with sticky session wrapper

#### Trade-offs
**Advantages:**
- Official Socket.IO solution
- Automatic sticky session handling
- Built-in cluster adapter
- No Nginx changes required

**Disadvantages:**
- Requires code changes in `server/routes.ts`
- Package is in beta stage
- Different PM2 command line tool
- More dependencies to maintain

### Option 4: Redis Adapter (Enterprise Solution)

#### Overview
Use Redis to share Socket.IO state across all workers, eliminating sticky session requirements.

#### Implementation Requirements
- Install Redis server
- Install `@socket.io/redis-adapter` package
- Configure Socket.IO to use Redis adapter
- All workers share state via Redis pub/sub

#### Trade-offs
**Advantages:**
- Most scalable solution
- No sticky sessions required
- Supports multiple servers (horizontal scaling)
- Can scale beyond single machine

**Disadvantages:**
- Requires Redis infrastructure
- Additional service to maintain
- Slight latency overhead
- More complex architecture

---

## Phase 1 Implementation Details (Immediate Fix)

### Step 1: Backup Current Configuration

### Phase 2: Backend Verification

#### Application Health Check
Verify the Node.js application is running correctly:
- Check PM2 process status
- Review application logs for startup errors
- Verify Socket.IO server initialization
- Confirm port binding (0.0.0.0 vs localhost)

#### Socket.IO Server Configuration Review
Ensure server-side configuration is production-ready:
- CORS settings allow production domain
- Path configuration matches client expectations
- Transport options are appropriate (polling + websocket)
- Ping timeout and interval values are reasonable

#### Environment Configuration
Verify production environment variables:
- `NODE_ENV=production`
- `PORT` correctly set
- `JWT_SECRET` configured
- Database connection string valid

### Phase 3: Client-Side Verification

#### Connection URL Configuration
Verify client Socket.IO initialization:
- Connection URL should be relative path `/` in production
- No hardcoded localhost references
- Transport order appropriate for production

#### Browser Console Diagnostics
Check client-side connection behavior:
- Network tab shows correct request URLs
- WebSocket upgrade attempts visible
- Error messages provide diagnostic information

### Phase 4: Testing Strategy

## Testing Strategy

### Phase 1 Testing (Fork Mode)

1. **Basic HTTP Proxy Test**
   - Access main application URL
   - Verify page loads correctly
   - Check Network tab for successful API calls

2. **Socket.IO Polling Test**
   - Monitor Network tab for `/socket.io/?EIO=4&transport=polling` requests
   - Verify 200 OK response instead of 400
   - Check response contains session ID

3. **WebSocket Upgrade Test**
   - Look for "101 Switching Protocols" response
   - Verify WebSocket connection established
   - Monitor WS frames in browser DevTools

4. **Real-Time Feature Test**
   - Send message between two users
   - Verify instant delivery without page refresh
   - Check activity stream updates in real-time

### Phase 2 Testing (Cluster Mode with Sticky Sessions)

#### Load Balancing Verification
1. **Multi-Worker Connection Test**
   - Connect multiple clients
   - Verify connections distributed across workers
   - Check PM2 logs show activity on all processes

2. **Session Affinity Test**
   - Connect client and note assigned worker
   - Send multiple requests
   - Verify all requests route to same worker
   - Check Nginx access logs for routing consistency

3. **Failover Test**
   - Kill one PM2 worker process
   - Verify clients reconnect to different worker
   - Check no data loss or session corruption

4. **Load Distribution Test**
   - Connect many clients (e.g., 100+)
   - Verify even distribution across workers
   - Monitor CPU usage across cores

---

## Diagnostic Procedures

### Server-Side Diagnostics
- Check PM2 status and logs
- Verify port listening with netstat or lsof
- Review Nginx access and error logs
- Check application logs for Socket.IO connections

### Client-Side Diagnostics
- Enable Socket.IO debug logging: `localStorage.debug = 'socket.io-client:*'`
- Monitor Network tab for request/response details
- Check Console for connection events

### Common Error Patterns

| Error | Cause | Solution |
|-------|-------|----------|
| 400 Bad Request: Session ID unknown | Cluster mode without sticky sessions | Implement Phase 1 or Phase 2 solution |
| 502 Bad Gateway | PM2 process not running | Check PM2 status and restart |
| 101 upgrade timeout | Nginx timeout too short | Increase proxy timeout values |
| Connection refused | Wrong port configuration | Verify PM2 PORT matches Nginx proxy |
| CORS error | Cloudflare or Nginx headers | Check CORS configuration and headers |

---

## Rollback Plan

If issues persist after configuration changes:

1. **Immediate Rollback**
   - Restore previous Nginx configuration
   - Restart Nginx service
   - Verify basic site functionality

2. **Alternative Approaches**
   - Dedicated subdomain for WebSocket connections (e.g., ws.reader.market)
   - Different port for Socket.IO with Cloudflare Spectrum
   - Use polling-only transport temporarily while debugging

## Configuration Examples

### Phase 1: Fork Mode Configuration

**Modified `ecosystem.config.cjs`:**
```
module.exports = {
  apps: [{
    name: 'ollama-reader',
    script: './dist/index.cjs',
    instances: 1,                    // Changed from 'max'
    exec_mode: 'fork',               // Changed from 'cluster'
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
      // ... rest of environment variables unchanged
    },
    // ... rest of configuration unchanged
  }]
};
```

**No Nginx changes required** - existing configuration works perfectly

### Phase 2: Nginx Sticky Sessions Configuration

#### Upstream Block (Add before server block):
```
upstream socketio_backend {
    ip_hash;  # Enable sticky sessions based on client IP
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
    server 127.0.0.1:5003;
    server 127.0.0.1:5004;
    keepalive 64;
}
```

#### Modified Socket.IO Location Block:
```
location /socket.io/ {
    proxy_pass http://socketio_backend;  # Changed from http://127.0.0.1:5001
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ... rest of headers unchanged
}
```

#### Modified PM2 Configuration for Multi-Port:
```
module.exports = {
  apps: [{
    name: 'ollama-reader',
    script: './dist/index.cjs',
    instances: 4,                    // Back to multiple instances
    exec_mode: 'cluster',            // Back to cluster mode
    env: {
      NODE_ENV: 'production',
      PORT: 5001,  // PM2 will increment this for each instance
      // Note: May need custom logic to handle port assignment
    },
  }]
};
```

**Alternative: Cookie-based routing**
```
upstream socketio_backend {
    hash $cookie_socketio_session consistent;  # Use cookie for routing
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
    server 127.0.0.1:5003;
    server 127.0.0.1:5004;
}
```

---

## Risk Assessment and Mitigation

### Phase 1 Risks (Fork Mode)

**High Risks:**
- Reduced throughput under high load (single process)
- Single point of failure (no worker redundancy)
- Underutilized CPU cores

**Mitigation:**
- Monitor connection count and response times
- Set up alerts for high CPU usage
- Have Phase 2 plan ready for quick deployment
- Consider vertical scaling if needed

**Low Risks:**
- Configuration change is minimal
- Easy rollback to cluster mode
- No Nginx changes required

### Phase 2 Risks (Sticky Sessions)

**Medium-High Risks:**
- Nginx configuration complexity increases
- Multi-port PM2 setup requires careful testing
- Load balancing may be uneven initially
- Worker crashes affect subset of users

**Mitigation:**
- Test configuration thoroughly in staging
- Use `nginx -t` before reloading
- Monitor worker distribution metrics
- Keep fork mode config as backup

**Low-Medium Risks:**
- Cloudflare CDN caching issues
- Cookie or IP-based routing edge cases
- Port assignment conflicts

**Mitigation:**
- Purge Cloudflare cache after changes
- Test with various client scenarios
- Document port ranges clearly

---

## Performance Comparison

| Metric | Fork Mode (Phase 1) | Cluster with Sticky (Phase 2) |
|--------|-------------------|------------------------------|
| CPU Utilization | Single core only | All cores |
| Max Concurrent Connections | ~1,000-2,000 | ~4,000-8,000 (4 workers) |
| Request Throughput | Baseline | 3-4x baseline |
| Memory Usage | Single process | 4x single process |
| Fault Tolerance | Single point of failure | Worker-level redundancy |
| Complexity | Low | Medium |
| Setup Time | 5 minutes | 30-60 minutes |

---

## Success Criteria

### Functional Requirements
- ✓ Socket.IO connections establish successfully (HTTP 200, then 101 for WebSocket)
- ✓ Real-time messaging works without page refresh
- ✓ Typing indicators appear instantly
- ✓ Activity stream updates in real-time
- ✓ Unread badge updates automatically

### Performance Requirements
- Initial connection time < 2 seconds
- Message delivery latency < 500ms
- Reconnection on network interruption < 5 seconds

### Monitoring Requirements
- Server logs show successful Socket.IO connections
- No 400 Bad Request errors in Nginx access logs
- PM2 logs show WebSocket room joins/leaves
- Browser console shows clean connection lifecycle

---

## Decision Matrix

### When to Use Each Solution

#### Use Fork Mode (Phase 1) If:
- ✓ Need immediate fix
- ✓ Traffic < 1,000 concurrent users
- ✓ Single CPU core performance is sufficient
- ✓ Want simplest possible solution
- ✓ Can scale vertically if needed

#### Use Sticky Sessions (Phase 2) If:
- ✓ Traffic > 1,000 concurrent users
- ✓ Need to utilize multiple CPU cores
- ✓ Want better fault tolerance
- ✓ Single server is sufficient long-term
- ✓ Comfortable with Nginx configuration

#### Use @socket.io/pm2 (Phase 3) If:
- ✓ Want official Socket.IO solution
- ✓ Comfortable modifying server code
- ✓ Don't mind beta software
- ✓ Want PM2-managed sticky sessions

#### Use Redis Adapter (Phase 4) If:
- ✓ Scaling to multiple servers
- ✓ Need horizontal scalability
- ✓ Can manage Redis infrastructure
- ✓ Want most robust solution
- ✓ Enterprise-level traffic

---

## Success Criteria

### Phase 1 Success Criteria
- [ ] PM2 running in fork mode with single instance
- [ ] Socket.IO connections establish without 400 errors
- [ ] All real-time features functional
- [ ] No performance degradation under current load

### Phase 2 Success Criteria  
- [ ] PM2 running in cluster mode with multiple instances
- [ ] Nginx sticky sessions routing correctly
- [ ] Load distributed across all workers
- [ ] Socket.IO sessions maintained properly
- [ ] Improved throughput vs fork mode
- [ ] Worker failover functions correctly

---

---

## Appendix: Technical Background

### Why PM2 Cluster Mode Causes Socket.IO Issues

**Process Isolation in Cluster Mode:**
- Each PM2 worker is a separate Node.js process
- Workers do not share memory or state
- Socket.IO session data stored in process memory
- Session IDs generated by one worker are unknown to others

**HTTP Long-Polling Flow:**
1. Client → Nginx → Worker A: Initial connection
2. Worker A generates session ID: `sid=abc123`
3. Worker A stores session in memory
4. Client → Nginx → Worker B: Next polling request with `sid=abc123`
5. Worker B checks session store: "Session ID unknown"
6. Worker B returns 400 Bad Request

**Why Sticky Sessions Fix This:**
- Nginx routes all requests from same client to same worker
- Worker always recognizes its own session IDs
- Session state remains consistent
- No session lookup failures

### Socket.IO Transport Mechanisms

**HTTP Long-Polling:**
- Multiple HTTP requests for single connection
- Requires session affinity across requests
- More reliable through firewalls/proxies
- Higher latency, more overhead

**WebSocket:**
- Single persistent TCP connection
- Automatic session affinity (same connection)
- Lower latency, less overhead
- May be blocked by some networks

**Why Both Transports Matter:**
- WebSocket preferred for performance
- Polling provides fallback for compatibility
- Socket.IO automatically chooses best transport
- Both must work for universal compatibility

---

## Conclusion

The Socket.IO 400 Bad Request error on production is caused by PM2 cluster mode running multiple worker processes without sticky session configuration. Each worker maintains isolated Socket.IO session state, causing "Session ID unknown" errors when clients' subsequent requests reach different workers.

**Recommended Solution:** Two-phase approach
1. **Immediate**: Switch PM2 to fork mode (single process) to restore functionality within minutes
2. **Optimization**: Implement Nginx sticky sessions to re-enable cluster mode for better performance

The fix is straightforward with low risk when proper testing and rollback procedures are followed.
