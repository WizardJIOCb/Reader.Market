/**
 * Middleware for logging user navigation and interaction activities
 * Captures route changes and logs them to the user_actions table
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// Feature flag for action tracking
const ENABLE_LAST_ACTIONS_TRACKING = process.env.ENABLE_LAST_ACTIONS_TRACKING === 'true';
console.log('[Action Logging] Feature enabled:', ENABLE_LAST_ACTIONS_TRACKING, '(env value:', process.env.ENABLE_LAST_ACTIONS_TRACKING, ')');

// Route pattern mappings to action types
const ROUTE_PATTERNS: { pattern: RegExp; actionType: string; targetType?: string }[] = [
  { pattern: /^\/api\/page-view\/home$/, actionType: 'navigate_home' },
  { pattern: /^\/api\/page-view\/stream$/, actionType: 'navigate_stream' },
  { pattern: /^\/api\/page-view\/search/, actionType: 'navigate_search' },
  { pattern: /^\/api\/page-view\/shelves$/, actionType: 'navigate_shelves' },
  { pattern: /^\/api\/page-view\/messages$/, actionType: 'navigate_messages' },
  { pattern: /^\/api\/page-view\/about$/, actionType: 'navigate_about' },
  { pattern: /^\/api\/page-view\/users$/, actionType: 'navigate_users' },
  { pattern: /^\/api\/page-view\/collections$/, actionType: 'navigate_collections' },
  { pattern: /^\/api\/page-view\/git-to-gpt$/, actionType: 'navigate_git_to_gpt' },
  { pattern: /^\/api\/collections\/([a-zA-Z0-9-]+)$/, actionType: 'navigate_collection', targetType: 'collection' },
  { pattern: /^\/api\/profile\/([a-zA-Z0-9-]+)$/, actionType: 'navigate_profile', targetType: 'user' },
  { pattern: /^\/api\/news\/([a-zA-Z0-9-]+)$/, actionType: 'navigate_news', targetType: 'news' },
  { pattern: /^\/api\/books\/([a-zA-Z0-9-]+)$/, actionType: 'navigate_book', targetType: 'book' },
  { pattern: /^\/api\/books\/([a-zA-Z0-9-]+)\/reader/, actionType: 'navigate_reader', targetType: 'book' }
];

/**
 * Extracts target ID from URL path based on pattern
 */
function extractTargetId(path: string, pattern: RegExp): string | null {
  const match = path.match(pattern);
  return match && match[1] ? match[1] : null;
}

/**
 * Logs user action asynchronously without blocking response
 * Exported for use in direct API calls
 */
export async function logActionAsync(actionData: any, io?: any): Promise<void> {
  try {
    console.log('[Action Logging] Creating action in database:', actionData.actionType);
    
    // Fetch additional metadata if needed
    if (actionData.metadata?.needsCollectionName && actionData.targetId) {
      try {
        const collection = await storage.getBookmarkCollection(actionData.targetId, actionData.userId);
        if (collection) {
          actionData.metadata.collectionName = collection.name;
          actionData.metadata.collectionOwner = collection.ownerUsername;
        }
      } catch (error) {
        console.error('[Action Logging] Failed to fetch collection info:', error);
      }
      // Remove the temporary flag
      delete actionData.metadata.needsCollectionName;
    }
    
    // For profile views, if targetId is not a UUID, try to resolve it as a username
    if (actionData.actionType === 'navigate_profile' && actionData.targetId) {
      // Check if targetId is a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(actionData.targetId);
      
      if (!isUuid) {
        // Target ID is a username, resolve it to user ID
        try {
          const targetUser = await storage.getUserByUsername(actionData.targetId);
          if (targetUser) {
            actionData.targetId = targetUser.id; // Replace username with actual user ID
            actionData.metadata.resolvedUsername = targetUser.username;
            actionData.metadata.resolvedFullName = targetUser.fullName || null;
            console.log('[Action Logging] Resolved username', actionData.metadata.resolvedUsername, 'to user ID', targetUser.id);
          } else {
            console.log('[Action Logging] Could not resolve username:', actionData.targetId);
          }
        } catch (error) {
          console.error('[Action Logging] Failed to resolve username to user ID:', error);
        }
      }
    }
    
    const action = await storage.createUserAction(actionData);
    console.log('[Action Logging] Action created with ID:', action?.id);
    
    // Broadcast to WebSocket if io is provided and action was created
    if (io && action) {
      console.log('[Action Logging] Fetching user info for broadcast...');
      // Get user info for broadcast
      const user = await storage.getUser(actionData.userId);
      console.log('[Action Logging] User found:', user?.username);
      
      // Get target details if available
      let targetData: any = null;
      if (actionData.targetType && actionData.targetId) {
        console.log('[Action Logging] Fetching target details:', actionData.targetType, actionData.targetId);
        switch (actionData.targetType) {
          case 'book':
            const book = await storage.getBook(actionData.targetId);
            if (book) {
              targetData = {
                type: 'book',
                id: book.id,
                title: book.title
              };
              console.log('[Action Logging] Book target:', book.title);
            }
            break;
          case 'news':
            const news = await storage.getNews(actionData.targetId);
            if (news) {
              targetData = {
                type: 'news',
                id: news.id,
                title: news.title
              };
              console.log('[Action Logging] News target:', news.title);
            }
            break;
          case 'user':
            // For profile views, we might have resolved the username already
            let targetUser;
            if (actionData.metadata?.resolvedUsername) {
              // Use the resolved user data
              targetUser = {
                id: actionData.targetId,
                username: actionData.metadata.resolvedUsername,
                fullName: actionData.metadata.resolvedFullName
              };
              console.log('[Action Logging] Using resolved user data for target:', targetUser.username);
            } else {
              // Fetch user normally
              targetUser = await storage.getUser(actionData.targetId);
            }
            
            if (targetUser) {
              targetData = {
                type: 'user',
                id: targetUser.id,
                username: targetUser.username,
                full_name: targetUser.fullName || null
              };
              console.log('[Action Logging] User target:', targetUser.username);
            }
            break;
        }
      }
      
      const broadcastData = {
        id: action.id,
        type: 'user_action',
        action_type: action.actionType,
        user: {
          id: user?.id,
          username: user?.username,
          avatar_url: user?.avatarUrl
        },
        target: targetData,
        metadata: action.metadata,
        timestamp: action.createdAt.toISOString()
      };
      
      // Check room status
      const lastActionsRoom = io.sockets.adapter.rooms.get('stream:last-actions');
      console.log('[Action Logging] stream:last-actions room size:', lastActionsRoom ? lastActionsRoom.size : 0);
      if (lastActionsRoom && lastActionsRoom.size > 0) {
        console.log('[Action Logging] Socket IDs in last-actions room:', Array.from(lastActionsRoom));
      }
      
      console.log('[Action Logging] Broadcasting action:', action.actionType, 'to room: stream:last-actions');
      console.log('[Action Logging] Broadcast data:', JSON.stringify(broadcastData));
      io.to('stream:last-actions').emit('stream:last-action', broadcastData);
      console.log('[Action Logging] Broadcast completed');
    } else {
      if (!io) {
        console.log('[Action Logging] Socket.IO not available for broadcast');
      }
      if (!action) {
        console.log('[Action Logging] Action not created, skipping broadcast');
      }
    }
  } catch (error) {
    console.error('[Action Logging] Failed to log action:', error);
    // Don't throw error - graceful degradation
  }
}

/**
 * Middleware function to log user actions
 * Should be applied after authentication middleware
 */
export function logUserAction(req: Request, res: Response, next: NextFunction): void {
  // Skip if feature is disabled
  if (!ENABLE_LAST_ACTIONS_TRACKING) {
    console.log('[Action Logging] Feature disabled');
    next();
    return;
  }

  // Only log for authenticated users
  const user = (req as any).user;
  if (!user || !user.userId) {
    next();
    return;
  }

  // Update last activity timestamp for any authenticated request
  setImmediate(async () => {
    try {
      await storage.updateUserLastActivity(user.userId);
    } catch (error) {
      console.error('[Action Logging] Failed to update last activity:', error);
    }
  });

  // Only log GET requests (navigation)
  if (req.method !== 'GET') {
    next();
    return;
  }

  const path = req.path;
  console.log('[Action Logging] Processing path:', path);

  // Find matching route pattern
  for (const { pattern, actionType, targetType } of ROUTE_PATTERNS) {
    if (pattern.test(path)) {
      console.log('[Action Logging] Pattern matched:', actionType, 'for path:', path);
      // Extract target ID if applicable
      const targetId = targetType ? extractTargetId(path, pattern) : null;
      console.log('[Action Logging] Target ID:', targetId);

      // Build action data
      const actionData: any = {
        userId: user.userId,
        actionType,
        targetType: targetType || null,
        targetId,
        metadata: {}
      };

      // Add metadata for specific action types
      if (actionType === 'navigate_collection' && targetId) {
        // For collection views, we'll fetch the collection name later
        actionData.metadata.needsCollectionName = true;
      }

      // Get Socket.IO instance from app
      const io = (req.app as any).io;
      console.log('[Action Logging] Socket.IO available:', !!io);

      // Log action asynchronously (fire and forget) with WebSocket broadcast
      setImmediate(() => {
        logActionAsync(actionData, io);
      });

      break; // Stop after first match
    }
  }

  // Continue with request
  next();
}

/**
 * Helper function to log public group message action
 * Called directly from the group message endpoint
 */
export async function logGroupMessageAction(
  userId: string,
  groupId: string,
  groupName: string,
  messageContent: string,
  io?: any
): Promise<void> {
  if (!ENABLE_LAST_ACTIONS_TRACKING) {
    return;
  }

  try {
    const actionData = {
      userId,
      actionType: 'send_group_message',
      targetType: 'group',
      targetId: groupId,
      metadata: {
        group_name: groupName,
        message_preview: messageContent.substring(0, 100)
      }
    };

    const action = await storage.createUserAction(actionData);

    // Broadcast to WebSocket if io is provided
    if (io && action) {
      // Get user info for broadcast
      const user = await storage.getUser(userId);

      const broadcastData = {
        id: action.id,
        type: 'user_action',
        action_type: action.actionType,
        user: {
          id: user?.id,
          username: user?.username,
          avatar_url: user?.avatarUrl
        },
        target: {
          type: 'group',
          id: groupId,
          name: groupName
        },
        metadata: action.metadata,
        timestamp: action.createdAt.toISOString()
      };

      io.to('stream:last-actions').emit('stream:last-action', broadcastData);
    }
  } catch (error) {
    console.error('[Action Logging] Failed to log group message action:', error);
    // Graceful degradation - don't throw
  }
}
