import { Router, type Express } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../storage/db';
import { 
  groups, 
  groupMembers, 
  groupBooks, 
  channels, 
  messages as messagesTable, 
  userChannelReadPositions,
  users 
} from '@shared/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';

export function createGroupsRouter() {
  const router = Router();

// Create group
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, description, privacy = 'public' } = req.body;
    const userId = (req as any).user.userId;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const newGroup = await db
      .insert(groups)
      .values({
        name,
        description: description || null,
        creatorId: userId,
        privacy
      })
      .returning();

    // Add creator as administrator
    await db.insert(groupMembers).values({
      groupId: newGroup[0].id,
      userId,
      role: 'administrator'
    });

    res.status(201).json(newGroup[0]);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get user's groups
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const userGroups = await db
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        privacy: groups.privacy,
        createdAt: groups.createdAt,
        role: groupMembers.role
      })
      .from(groups)
      .innerJoin(groupMembers, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userId))
      .orderBy(desc(groups.createdAt));

    res.json(userGroups);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Search groups
router.get("/search", authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    const userId = (req as any).user.userId;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchResults = await db
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        privacy: groups.privacy,
        createdAt: groups.createdAt,
        isMember: sql<boolean>`CASE WHEN ${groupMembers.groupId} IS NOT NULL THEN true ELSE false END`
      })
      .from(groups)
      .leftJoin(groupMembers, and(eq(groups.id, groupMembers.groupId), eq(groupMembers.userId, userId)))
      .where(and(
        eq(groups.privacy, 'public'),
        sql`${groups.name} ILIKE ${`%${q}%`}`
      ))
      .orderBy(desc(groups.createdAt))
      .limit(20);

    res.json(searchResults);
  } catch (error) {
    console.error('Error searching groups:', error);
    res.status(500).json({ error: 'Failed to search groups' });
  }
});

// Get group by ID
router.get("/:groupId", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = (req as any).user.userId;

    const group = await db
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        privacy: groups.privacy,
        creatorId: groups.creatorId,
        createdAt: groups.createdAt,
        role: groupMembers.role
      })
      .from(groups)
      .leftJoin(groupMembers, and(eq(groups.id, groupMembers.groupId), eq(groupMembers.userId, userId)))
      .where(eq(groups.id, groupId))
      .limit(1);

    if (!group[0]) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user has access to private group
    if (group[0].privacy === 'private' && !group[0].role) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(group[0]);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Update group
router.put("/:groupId", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, privacy } = req.body;
    const userId = (req as any).user.userId;

    // Check if user is administrator
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (!membership[0] || membership[0].role !== 'administrator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedGroup = await db
      .update(groups)
      .set({
        name: name || undefined,
        description: description || undefined,
        privacy: privacy || undefined
      })
      .where(eq(groups.id, groupId))
      .returning();

    res.json(updatedGroup[0]);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete group
router.delete("/:groupId", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = (req as any).user.userId;

    // Check if user is administrator
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (!membership[0] || membership[0].role !== 'administrator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.delete(groups).where(eq(groups.id, groupId));

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Join group
router.post("/:groupId/join", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = (req as any).user.userId;

    // Check if group exists and is public
    const group = await db
      .select({ privacy: groups.privacy })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (!group[0]) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group[0].privacy !== 'public') {
      return res.status(403).json({ error: 'Cannot join private group' });
    }

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (existingMembership[0]) {
      return res.status(409).json({ error: 'Already a member of this group' });
    }

    await db.insert(groupMembers).values({
      groupId,
      userId,
      role: 'member'
    });

    res.json({ message: 'Joined group successfully' });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Manage group members
router.post("/:groupId/members", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId: targetUserId, role = 'member' } = req.body;
    const currentUserId = (req as any).user.userId;

    // Check if current user is administrator or moderator
    const currentMembership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, currentUserId)))
      .limit(1);

    if (!currentMembership[0] || (currentMembership[0].role !== 'administrator' && currentMembership[0].role !== 'moderator')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add or update member
    await db.insert(groupMembers)
      .values({
        groupId,
        userId: targetUserId,
        role
      })
      .onConflictDoUpdate({
        target: [groupMembers.groupId, groupMembers.userId],
        set: { role }
      });

    res.json({ message: 'Member added/updated successfully' });
  } catch (error) {
    console.error('Error managing group member:', error);
    res.status(500).json({ error: 'Failed to manage group member' });
  }
});

// Remove member from group
router.delete("/:groupId/members/:memberId", authenticateToken, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const currentUserId = (req as any).user.userId;

    // Check if current user is administrator or moderator
    const currentMembership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, currentUserId)))
      .limit(1);

    if (!currentMembership[0] || (currentMembership[0].role !== 'administrator' && currentMembership[0].role !== 'moderator')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Prevent removing oneself from group
    if (memberId === currentUserId) {
      return res.status(400).json({ error: 'Cannot remove yourself from group' });
    }

    await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing group member:', error);
    res.status(500).json({ error: 'Failed to remove group member' });
  }
});

// Update member role
router.put("/:groupId/members/:memberId/role", authenticateToken, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { role } = req.body;
    const currentUserId = (req as any).user.userId;

    // Check if current user is administrator
    const currentMembership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, currentUserId)))
      .limit(1);

    if (!currentMembership[0] || currentMembership[0].role !== 'administrator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Prevent changing own role
    if (memberId === currentUserId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    await db
      .update(groupMembers)
      .set({ role })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Get group members
router.get("/:groupId/members", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = (req as any).user.userId;

    // Check if user is a member
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, currentUserId)))
      .limit(1);

    if (!membership[0]) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(desc(groupMembers.joinedAt));

    res.json(members);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
});

// Get user's role in group
router.get("/:groupId/my-role", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = (req as any).user.userId;

    const membership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (!membership[0]) {
      return res.status(404).json({ error: 'Not a member of this group' });
    }

    res.json({ role: membership[0].role });
  } catch (error) {
    console.error('Error fetching user role:', error);
    res.status(500).json({ error: 'Failed to fetch user role' });
  }
});

// Create channel in group
router.post("/:groupId/channels", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const userId = (req as any).user.userId;

    // Check if user is administrator or moderator
    const membership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (!membership[0] || (membership[0].role !== 'administrator' && membership[0].role !== 'moderator')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const newChannel = await db
      .insert(channels)
      .values({
        groupId,
        name,
        description: description || null,
        creatorId: userId
      })
      .returning();

    res.status(201).json(newChannel[0]);
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Get channels in group
router.get("/:groupId/channels", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = (req as any).user.userId;

    // Check if user is a member
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (!membership[0]) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const groupChannels = await db
      .select({
        id: channels.id,
        name: channels.name,
        description: channels.description,
        creatorId: channels.creatorId,
        displayOrder: channels.displayOrder,
        createdAt: channels.createdAt,
        archivedAt: channels.archivedAt
      })
      .from(channels)
      .where(eq(channels.groupId, groupId))
      .orderBy(asc(channels.displayOrder), asc(channels.createdAt));

    res.json(groupChannels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Update channel
router.put("/:groupId/channels/:channelId", authenticateToken, async (req, res) => {
  try {
    const { groupId, channelId } = req.params;
    const { name, description, displayOrder } = req.body;
    const userId = (req as any).user.userId;

    // Check if user is administrator or moderator
    const membership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (!membership[0] || (membership[0].role !== 'administrator' && membership[0].role !== 'moderator')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if channel belongs to group
    const channel = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.groupId, groupId)))
      .limit(1);

    if (!channel[0]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const updatedChannel = await db
      .update(channels)
      .set({
        name: name || undefined,
        description: description || undefined,
        displayOrder: displayOrder !== undefined ? displayOrder : undefined
      })
      .where(eq(channels.id, channelId))
      .returning();

    res.json(updatedChannel[0]);
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Archive/delete channel
router.delete("/:groupId/channels/:channelId", authenticateToken, async (req, res) => {
  try {
    const { groupId, channelId } = req.params;
    const userId = (req as any).user.userId;

    // Check if user is administrator
    const membership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (!membership[0] || membership[0].role !== 'administrator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if channel belongs to group
    const channel = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.groupId, groupId)))
      .limit(1);

    if (!channel[0]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    await db.delete(channels).where(eq(channels.id, channelId));

    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

  return router;
}