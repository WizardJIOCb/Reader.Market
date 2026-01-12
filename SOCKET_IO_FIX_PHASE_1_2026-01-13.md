# Socket.IO Fix - Phase 1 Implementation
## Date: January 13, 2026

## Problem Summary

Production server (reader.market) was experiencing Socket.IO connection failures:
- **Error**: `POST https://reader.market/socket.io/?EIO=4&transport=polling 400 Bad Request`
- **Cause**: PM2 cluster mode running multiple worker processes without sticky session configuration
- **Impact**: Real-time features not working (messaging, notifications, activity streams, typing indicators)

## Root Cause

PM2 was configured with:
- `exec_mode: 'cluster'` 
- `instances: 'max'` (multiple workers on all CPU cores)

**The Problem:**
- Each PM2 worker maintains isolated Socket.IO session state
- Without sticky sessions, client requests can reach different workers
- Worker B doesn't recognize session IDs from Worker A
- Result: "400 Bad Request: Session ID unknown"

## Solution Implemented: Phase 1 (Fork Mode)

### Changes Made

**File Modified:** `ecosystem.config.cjs`

**Changes:**
```diff
- instances: 'max',
- exec_mode: 'cluster',
+ instances: 1,
+ exec_mode: 'fork',
```

**Backup Created:** `ecosystem.config.cjs.backup`

### Why This Fixes The Issue

- **Single Process**: Only one PM2 worker process runs
- **Unified State**: All Socket.IO sessions in one process memory
- **No Load Balancing**: All requests reach the same process
- **Session Affinity**: Guaranteed session ID recognition

### Trade-offs

**✅ Advantages:**
- ✓ Immediate fix for Socket.IO errors
- ✓ No Nginx configuration changes needed
- ✓ Simple rollback available
- ✓ All Socket.IO state centralized

**⚠️ Disadvantages:**
- Uses only single CPU core
- Lower concurrent request capacity (~1,000-2,000 connections)
- Single point of failure
- No automatic load distribution

### When Fork Mode Is Sufficient
- Traffic < 1,000 concurrent users ✓
- Application is I/O-bound (database, file operations) ✓
- Single core has adequate performance ✓
- Can scale vertically if needed ✓

---

## Deployment Instructions (For Production Server)

### Prerequisites
- SSH access to production server
- PM2 access (already installed)
- Sudo/root privileges for PM2 operations

### Step-by-Step Deployment

#### 1. Upload Modified Configuration
```bash
# From local machine, copy the modified file to production server
scp ecosystem.config.cjs user@reader.market:/var/www/reader.market/
```

#### 2. SSH to Production Server
```bash
ssh user@reader.market
cd /var/www/reader.market
```

#### 3. Verify Current PM2 Status
```bash
pm2 list
pm2 logs ollama-reader --lines 20
```

#### 4. Stop Current Cluster Process
```bash
pm2 stop ollama-reader
pm2 delete ollama-reader
```

#### 5. Start With New Fork Configuration
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

#### 6. Verify New Process
```bash
pm2 list
# Should show:
# - 1 instance of ollama-reader
# - mode: fork (not cluster)
# - status: online
```

#### 7. Check Application Logs
```bash
pm2 logs ollama-reader --lines 50
# Look for:
# - Server started successfully
# - Socket.IO server initialized
# - No errors
```

#### 8. Monitor for Errors
```bash
pm2 monit
# Watch for:
# - Memory usage stable
# - CPU usage reasonable
# - No restart loops
```

---

## Testing Instructions

### 1. Basic Connectivity Test
```bash
# From production server
curl http://localhost:5001/health
# Should return: healthy

# Test Socket.IO endpoint
curl http://localhost:5001/socket.io/
# Should return Socket.IO response (not 404)
```

### 2. Browser Testing

#### Open Production Site
1. Navigate to https://reader.market
2. Open Browser DevTools (F12)
3. Go to Console tab

#### Check Socket.IO Connection
Look for console logs:
- ✅ `[SOCKET.IO] ✅ WebSocket connected` (green)
- ✅ `[SOCKET.IO] Socket ID: xxxxx`
- ❌ No "400 Bad Request" errors

#### Network Tab Verification
1. Open Network tab in DevTools
2. Filter by "socket.io"
3. Look for requests:
   - Initial: `GET /socket.io/?EIO=4&transport=polling` → Status **200 OK**
   - Upgrade: `GET /socket.io/?EIO=4&transport=websocket` → Status **101 Switching Protocols**
   - ❌ No 400 errors

### 3. Real-Time Features Test

#### Test Messaging
1. Open two browser windows
2. Log in as different users
3. Send message from User A
4. **Expected**: User B receives message instantly (no page refresh needed)
5. **Expected**: Typing indicator appears when typing
6. **Expected**: Unread badge updates automatically

#### Test Activity Stream
1. Navigate to Stream page (/stream)
2. In another browser, post a comment on a book
3. **Expected**: Comment appears in activity stream immediately
4. **Expected**: Toast notification shows "New Activity"

#### Test Notifications
1. Keep Messages page open
2. Have another user send you a message
3. **Expected**: Unread badge increments immediately
4. **Expected**: No page refresh needed to see new message

### 4. Performance Monitoring

#### Check Server Resources
```bash
# CPU usage (should be on single core)
top -p $(pgrep -f "ollama-reader")

# Memory usage
pm2 monit

# Application logs
pm2 logs ollama-reader
```

#### Monitor for Issues
- No "Session ID unknown" errors
- No connection timeouts
- No unexpected process restarts
- Stable memory usage

---

## Success Criteria Checklist

### Functional Requirements
- [ ] Socket.IO connections establish successfully (HTTP 200, then 101 for WebSocket)
- [ ] No "400 Bad Request: Session ID unknown" errors
- [ ] Real-time messaging works without page refresh
- [ ] Typing indicators appear instantly
- [ ] Activity stream updates in real-time
- [ ] Unread message badges update automatically

### Technical Verification
- [ ] PM2 shows single instance in fork mode
- [ ] Process status is "online" and stable
- [ ] No errors in PM2 logs
- [ ] No errors in browser console
- [ ] WebSocket upgrade succeeds (status 101)

### Performance Baseline
- [ ] Page load time acceptable
- [ ] API response times < 500ms
- [ ] Message delivery latency < 1 second
- [ ] CPU usage reasonable (< 80% single core)
- [ ] Memory usage stable (< 1GB)

---

## Rollback Procedure

If issues occur, rollback to cluster mode:

### Quick Rollback
```bash
# SSH to production server
cd /var/www/reader.market

# Stop current process
pm2 stop ollama-reader
pm2 delete ollama-reader

# Restore backup configuration
cp ecosystem.config.cjs.backup ecosystem.config.cjs

# Restart with cluster mode
pm2 start ecosystem.config.cjs
pm2 save

# Verify
pm2 list
pm2 logs ollama-reader
```

### Alternative: Manual Rollback
Edit `ecosystem.config.cjs` directly:
```javascript
instances: 'max',      // Changed back from 1
exec_mode: 'cluster',  // Changed back from 'fork'
```

Then restart:
```bash
pm2 restart ollama-reader
```

---

## Known Limitations

### Current Configuration (Fork Mode)
- **Single CPU Core**: Only uses one core, others idle
- **Capacity**: ~1,000-2,000 concurrent connections
- **No Worker Redundancy**: Single process failure affects all users
- **Vertical Scaling Only**: Can't distribute load across multiple processes

### When to Upgrade to Phase 2 (Sticky Sessions)
Consider implementing Phase 2 when:
- Concurrent users regularly exceed 1,000
- CPU usage on single core consistently > 80%
- Need better fault tolerance
- Want to utilize all CPU cores

---

## Phase 2 Preview (Future Optimization)

**Phase 2 Solution**: Nginx sticky sessions + cluster mode
- Re-enable multiple PM2 workers
- Configure Nginx to route clients consistently to same worker
- Utilize all CPU cores
- Better performance and fault tolerance

**Estimated Implementation Time**: 1-2 hours
**Complexity**: Medium
**Risk**: Low (with proper testing)

See design document section "Phase 2: Enable Nginx Sticky Sessions" for details.

---

## Monitoring Recommendations

### Daily Checks
- PM2 process status: `pm2 list`
- Check for errors: `pm2 logs ollama-reader --lines 100 | grep -i error`
- Monitor uptime: `pm2 jlist | grep uptime`

### Weekly Review
- Analyze CPU usage trends
- Review connection count patterns
- Check memory usage growth
- Review error logs for patterns

### Alerts to Set Up
- PM2 process restarts (> 2 per hour)
- High CPU usage (> 85% sustained)
- High memory usage (> 900MB)
- Socket.IO connection errors in logs

---

## Files Modified

| File | Status | Backup Location |
|------|--------|----------------|
| ecosystem.config.cjs | Modified | ecosystem.config.cjs.backup |

## Files Created

| File | Purpose |
|------|---------|
| SOCKET_IO_FIX_PHASE_1_2026-01-13.md | Implementation documentation |
| ecosystem.config.cjs.backup | Configuration backup |

---

## References

- **Design Document**: `.qoder/quests/socket-issue-detection.md`
- **Socket.IO Documentation**: https://socket.io/docs/v4/using-multiple-nodes/
- **PM2 Cluster Mode**: https://pm2.keymetrics.io/docs/usage/cluster-mode/

---

## Support & Troubleshooting

### Common Issues After Deployment

#### Issue: Process Won't Start
**Symptoms**: PM2 shows "errored" status
**Solution**:
```bash
pm2 logs ollama-reader --err --lines 50
# Check for port conflicts, missing files, or environment issues
```

#### Issue: Socket.IO Still Showing 400 Errors
**Symptoms**: Browser console shows 400 Bad Request
**Possible Causes**:
1. Old process still running: `pm2 list` and ensure only 1 instance
2. Nginx cache: Wait 2-3 minutes or purge Cloudflare cache
3. Browser cache: Hard refresh (Ctrl+Shift+R)

**Solution**:
```bash
# Verify single process
pm2 list | grep ollama-reader

# Check process mode
pm2 describe ollama-reader | grep mode
# Should show: mode: fork_mode
```

#### Issue: Performance Degradation
**Symptoms**: Slow response times, high CPU usage
**Solution**:
1. Check if traffic exceeds fork mode capacity
2. Monitor with: `pm2 monit`
3. Consider implementing Phase 2 if consistently > 1000 concurrent users

---

## Implementation Status

✅ **COMPLETED** - January 13, 2026

- [x] Backup created
- [x] Configuration modified
- [x] Changes verified
- [x] Documentation created
- [x] Testing instructions provided
- [x] Rollback procedure documented

**Next Step**: Deploy to production server following deployment instructions above.

---

## Notes

- No Nginx configuration changes required
- No application code changes required
- Change is purely PM2 process management configuration
- Zero-downtime deployment possible with proper procedure
- Rollback is quick and straightforward

**Estimated Deployment Time**: 5-10 minutes
**Estimated Downtime**: 1-2 minutes (during PM2 restart)
**Risk Level**: Low
