# Group Message Counter Issue - Design Document

## Problem Statement

Group messaging has the same unread message counter issue as personal messages had previously. When users view messages in a group channel, the unread badge on the group list does not clear because there is no mechanism to mark group channel messages as read or refresh the group list after viewing messages.

### Current Behavior

1. User opens a group and selects a channel
2. `fetchChannelMessages()` is called to load messages
3. Messages are displayed in the UI
4. **Issue**: No call to refresh group list or mark messages as read
5. **Result**: Unread badge remains on the group item indefinitely

### Expected Behavior

1. User opens a group and selects a channel
2. Messages are loaded and displayed
3. System marks messages as read (or updates user's last read position)
4. Group list is refreshed to show updated unread count (should be 0 or reduced)
5. Unread badge updates or disappears accordingly

## Root Cause Analysis

### Personal Messages (Already Fixed)

In `fetchMessages()` for private conversations (lines 634-663):
- Backend automatically marks messages as read when fetching
- Frontend adds 100ms delay for database commit
- Calls `fetchConversations()` to refresh conversation list
- Dispatches event to update navbar counter
- Badge clears correctly ✅

### Group Messages (Current Problem)

In `fetchChannelMessages()` for group channels (lines 615-632):
- Only fetches and displays messages
- **Missing**: No refresh of group list after viewing
- **Missing**: No mechanism to update user's last read position in the channel
- Badge does not clear ❌

## Technical Context

### Group Unread Counter Logic

Backend calculates group unread count in `getUserGroups()` (server/storage.ts, lines 3064-3081):

```
Counts messages where:
- Channel belongs to the group
- Message sender is not the current user
- Message is newer than user's last message in ANY channel of that group
- Message is not deleted
```

**Key Insight**: The current implementation tracks unread by comparing message timestamps with the user's last sent message timestamp in the entire group, not per-channel.

### Limitations of Current Approach

1. **No per-user, per-channel read tracking**: System doesn't store which messages each user has viewed in each channel
2. **Proxy-based unread detection**: Uses user's last sent message time as a proxy for "last seen"
3. **Imprecise counting**: If user reads messages but doesn't send any, their "last activity" timestamp doesn't update

## Solution Approaches

### Option 1: Mirror Personal Message Pattern (Quick Fix)

**Strategy**: Apply the same fix pattern used for personal messages to group channels.

**Changes Required**:

#### Frontend Changes (client/src/pages/Messages.tsx)

In `fetchChannelMessages()` function:
- Add delay after fetching messages (100ms)
- Call `fetchGroups()` to refresh group list
- Dispatch event to update navbar counter

#### Backend Changes (None Required for Quick Fix)

The backend already supports tracking by comparing with user's last message. When the user views messages and later sends a message, the unread count will automatically decrease.

**Limitation**: Badge only clears after user sends a message in the group, not immediately upon viewing.

---

### Option 2: Backend Read Tracking Enhancement (Robust Solution)

**Strategy**: Implement proper per-user, per-channel read position tracking.

**Changes Required**:

#### Database Schema

Create new table or add tracking mechanism:
- Track user_id
- Track channel_id  
- Track last_read_message_id or last_read_timestamp
- Update timestamp when user views channel

#### Backend Changes

**New Storage Method**: `updateUserChannelReadPosition(userId, channelId, timestamp)`
- Records when user last viewed a channel
- Updates tracking record

**Modified Query**: `getUserGroups()` unread count calculation
- Instead of comparing with user's last sent message
- Compare with user's last read position per channel
- More accurate unread count

#### API Endpoint

**New Route**: `PUT /api/groups/:groupId/channels/:channelId/mark-read`
- Called when user opens a channel
- Updates read position for that user and channel

#### Frontend Changes

In `fetchChannelMessages()`:
- After loading messages, call mark-read endpoint
- Add delay for database commit
- Call `fetchGroups()` to refresh group list with updated counts

---

### Option 3: Hybrid Approach (Recommended)

**Strategy**: Implement quick fix immediately, then enhance incrementally.

**Phase 1 - Immediate Fix**:
- Apply Option 1 changes to refresh group list after viewing channel
- Add manual "Mark as Read" button for users to clear badge explicitly

**Phase 2 - Future Enhancement**:
- Implement Option 2 read tracking mechanism
- Migrate from proxy-based to explicit read position tracking

## Recommended Solution: Hybrid Approach (Option 3)

### Phase 1: Immediate Mitigation

#### Frontend Changes

**File**: `client/src/pages/Messages.tsx`

**Modify `fetchChannelMessages` function**:

After receiving messages successfully, add:
1. Small delay to ensure any backend operations complete (100ms)
2. Call `fetchGroups()` to refresh group list with latest unread counts
3. Dispatch custom event to update navbar unread counter

**Expected behavior after Phase 1**:
- When user opens a channel, group list refreshes
- If backend unread logic detects messages have been "seen" (user sent a message after viewing), badge updates
- Not perfect, but better than current state

#### User Experience Impact

**Positive**:
- Group list stays fresh and synchronized
- Reduces confusion from stale data
- Consistent pattern with personal messages

**Limitation**:
- Badge may not clear immediately if user only reads without sending
- User may need to send a message to update their "last activity" timestamp

---

### Phase 2: Full Read Tracking (Future Work)

#### Database Design

**Approach**: Add per-user, per-channel read tracking

**Option A**: Extend existing table
- Add `user_channel_read_positions` table
- Columns: user_id, channel_id, last_read_message_id, last_read_at, updated_at

**Option B**: Use existing messages table
- Track "read_status" per recipient per channel message
- More storage overhead but more granular

**Recommendation**: Option A - dedicated tracking table for simplicity and performance

#### Backend Implementation

**New Storage Methods**:
- `updateChannelReadPosition(userId, channelId, messageId, timestamp)`
- `getChannelReadPosition(userId, channelId)`
- Modified `getUserGroups()` to use read positions instead of last sent message

**New API Route**:
- `PUT /api/groups/:groupId/channels/:channelId/mark-read`
- Body: `{ lastReadMessageId }`
- Response: `{ success: true, unreadCount: number }`

#### Frontend Integration

**WebSocket Events**:
- Emit `channel:viewed` when user opens a channel
- Backend updates read position
- Broadcast updated unread count to user's other connected sessions

**Automatic Mark-as-Read**:
- When `fetchChannelMessages()` completes successfully
- Call mark-read API with the latest message ID
- Refresh group list to reflect new counts

## Implementation Plan

### Phase 1 Tasks (Immediate)

1. **Update `fetchChannelMessages` in Messages.tsx**
   - Add 100ms delay after successful message fetch
   - Call `await fetchGroups()` to refresh group list
   - Dispatch `update-unread-count` event for navbar

2. **Test Phase 1 Changes**
   - Verify group list refreshes when channel is opened
   - Verify unread count updates (may require sending message)
   - Check navbar counter synchronization

3. **Document Behavior**
   - Add code comments explaining the workaround
   - Note limitation: badge clears only after user sends message
   - Reference Phase 2 enhancement plan

### Phase 2 Tasks (Future Enhancement)

1. **Database Migration**
   - Create `user_channel_read_positions` table
   - Add indexes for performance

2. **Backend Implementation**
   - Implement read position tracking methods
   - Add new API endpoint
   - Update `getUserGroups()` query logic

3. **Frontend Integration**
   - Call mark-read endpoint when viewing channel
   - Update WebSocket event handlers
   - Add optimistic UI updates

4. **Testing & Validation**
   - Test unread count accuracy
   - Verify performance with large message volumes
   - Cross-browser and multi-tab synchronization

## Success Criteria

### Phase 1 (Immediate Fix)

- ✅ Group list refreshes when user opens a channel
- ✅ No JavaScript errors in console
- ✅ Navbar unread counter updates when viewing group messages
- ⚠️ Badge clears after user activity in the group (sending message)

### Phase 2 (Full Solution)

- ✅ Badge clears immediately when user views channel messages
- ✅ Accurate unread counts without requiring user to send messages
- ✅ Per-channel read tracking for precise counts
- ✅ Multi-tab and multi-device synchronization
- ✅ Performance remains acceptable with large datasets

## Risk Assessment

### Phase 1 Risks

**Low Risk**:
- Mirrors existing pattern from personal messages fix
- No database schema changes
- Easy to rollback if issues arise

**Limitation**:
- Doesn't fully solve the problem (badge clearing delayed)
- User education may be needed about behavior

### Phase 2 Risks

**Medium Risk**:
- Database migration required
- Changes to core query logic
- Potential performance impact if not optimized

**Mitigation**:
- Thorough testing in staging environment
- Database indexing strategy
- Gradual rollout with monitoring

## Comparison with Personal Messages Solution

### Similarities

| Aspect | Personal Messages | Group Messages |
|--------|------------------|----------------|
| Symptom | Badge doesn't clear when viewing | Same issue |
| Root Cause | No refresh after viewing messages | Same pattern |
| Fix Pattern | Refresh list after viewing messages | Apply same pattern |
| Timing Consideration | 100ms delay for DB commit | Same delay needed |

### Differences

| Aspect | Personal Messages | Group Messages |
|--------|------------------|----------------|
| Read Tracking | Explicit `read_status` field per message | Proxy-based (user's last message timestamp) |
| Clearing Logic | Backend marks messages read on fetch | No automatic marking |
| Accuracy | Precise per-message tracking | Approximate based on activity |
| Future Enhancement | Already robust | Needs Phase 2 implementation |

## Acceptance Testing

### Test Case 1: Group Badge Updates After Viewing

**Setup**:
- User A and User B are both members of Group X
- User A has not viewed the group recently

**Steps**:
1. User B sends 3 messages in Channel #general of Group X
2. User A opens messages page - verify badge shows "3" on Group X
3. User A clicks Group X and views Channel #general messages
4. Wait 100ms for refresh

**Expected Result (Phase 1)**:
- Group list refreshes
- Badge may still show count if User A hasn't sent a message yet
- After User A sends a message, badge updates or clears

**Expected Result (Phase 2)**:
- Badge immediately clears or updates to 0
- Unread count reflects only messages in channels not yet viewed

### Test Case 2: Multiple Channels in Same Group

**Setup**:
- Group X has Channel #general and Channel #random
- User A has unread messages in both channels

**Steps**:
1. User A opens Group X and views Channel #general
2. Verify badge count
3. User A switches to Channel #random
4. Verify badge count again

**Expected Result (Phase 1)**:
- Badge may not differentiate between channels
- Count reflects group-wide unread messages

**Expected Result (Phase 2)**:
- Badge decrements after viewing Channel #general
- Badge decrements again after viewing Channel #random
- Accurate per-channel tracking

### Test Case 3: WebSocket Real-time Update

**Setup**:
- User A is viewing Group X, Channel #general
- User B sends a new message to Channel #general

**Steps**:
1. User B sends message
2. Observe User A's UI

**Expected Result**:
- Message appears in User A's message list via WebSocket
- Group list does NOT show increased unread count (user is viewing that channel)
- Navbar counter does NOT increment

## Related Documentation

- `UNREAD_MESSAGE_INDICATOR_IMPLEMENTATION_2026-01-07.md` - Original unread badge implementation
- `FIX_UNREAD_BADGE_CLEARING_TIMING_2026-01-08.md` - Personal messages badge clearing fix
- `FIX_UNREAD_BADGE_NOT_CLEARING_ON_OPEN_2026-01-08.md` - Related timing issue resolution
- `FIX_UNREAD_COUNT_ALWAYS_1.md` - Unread count calculation fix

## Notes

- This issue is a direct parallel to the personal messages counter issue that was previously resolved
- The root cause is the same: lack of list refresh after viewing messages
- Phase 1 provides immediate partial relief using proven pattern
- Phase 2 provides complete solution with proper read tracking architecture
