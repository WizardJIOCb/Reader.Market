/**
 * Helper functions for activity feed management
 * This module provides utilities for creating activity feed entries and broadcasting updates via WebSocket
 */

import { storage } from './storage';
import type { Server as SocketIOServer } from 'socket.io';

// Activity types
export type ActivityType = 'news' | 'book' | 'comment' | 'review';

// Activity metadata interfaces
interface NewsActivityMetadata {
  title: string;
  excerpt?: string;
  authorId: string;
  authorName?: string;
}

interface BookActivityMetadata {
  title: string;
  authorName?: string;
  coverUrl?: string;
  uploaderId: string;
  uploaderName?: string;
}

interface CommentActivityMetadata {
  content: string;
  authorId: string;
  authorName?: string;
  newsId?: string;
  newsTitle?: string;
  bookId?: string;
  bookTitle?: string;
}

interface ReviewActivityMetadata {
  content: string;
  rating?: number;
  authorId: string;
  authorName?: string;
  bookId: string;
  bookTitle?: string;
}

type ActivityMetadata = NewsActivityMetadata | BookActivityMetadata | CommentActivityMetadata | ReviewActivityMetadata;

interface CreateActivityParams {
  type: ActivityType;
  entityId: string;
  userId: string;
  targetUserId?: string;
  bookId?: string;
  metadata: ActivityMetadata;
  io?: SocketIOServer;
}

/**
 * Create a new activity feed entry and broadcast it via WebSocket
 */
export async function createActivity(params: CreateActivityParams): Promise<void> {
  const { type, entityId, userId, targetUserId, bookId, metadata, io } = params;

  try {
    // Create activity in database
    const activity = await storage.createActivity({
      activityType: type,
      entityId,
      userId,
      targetUserId,
      bookId,
      metadata
    });

    console.log(`[STREAM] Created ${type} activity:`, activity.id);

    // Broadcast to WebSocket rooms if io is provided
    if (!io) {
      console.warn('[STREAM] ⚠️ Socket.IO instance not provided - skipping broadcast');
      return;
    }
    
    if (!activity) {
      console.error('[STREAM] ❌ No activity created - skipping broadcast');
      return;
    }

    const activityData = {
      id: activity.id,
      type: activity.activityType,
      entityId: activity.entityId,
      userId: activity.userId,
      targetUserId: activity.targetUserId,
      bookId: activity.bookId,
      metadata: activity.metadata,
      createdAt: activity.createdAt
    };

    console.log('[STREAM] 📡 Broadcasting activity:', {
      activityId: activity.id,
      type: activity.activityType,
      entityId: activity.entityId,
      bookId: activity.bookId
    });

    // Get room information for debugging
    const globalRoom = io.sockets.adapter.rooms.get('stream:global');
    console.log(`[STREAM] 👥 'stream:global' room has ${globalRoom ? globalRoom.size : 0} connected sockets`);
    
    if (globalRoom && globalRoom.size > 0) {
      console.log('[STREAM] Socket IDs in global room:', Array.from(globalRoom));
    }

    // Broadcast to global stream
    io.to('stream:global').emit('stream:new-activity', activityData);
    console.log('\x1b[32m%s\x1b[0m', `[STREAM] ✅ Broadcasted 'stream:new-activity' to 'stream:global' room`);

    // Broadcast to personal stream if there's a target user
    if (targetUserId) {
      io.to(`user:${targetUserId}`).emit('stream:new-activity', activityData);
      console.log(`[STREAM] Broadcasted to personal stream of user ${targetUserId}`);
    }

    // Broadcast to shelf streams if activity is related to a book
    if (bookId) {
      // Get all users who have this book on their shelves
      const usersWithBook = await storage.getUsersWithBookOnShelf(bookId);
      
      for (const user of usersWithBook) {
        io.to(`stream:shelves:${user.userId}`).emit('stream:new-activity', activityData);
      }
      
      console.log(`[STREAM] Broadcasted to ${usersWithBook.length} shelf streams`);
    }
  } catch (error) {
    console.error('[STREAM] Error creating activity:', error);
    throw error;
  }
}

/**
 * Create activity when news is published
 */
export async function createNewsActivity(
  newsId: string,
  title: string,
  authorId: string,
  authorName: string,
  excerpt: string,
  io?: SocketIOServer
): Promise<void> {
  await createActivity({
    type: 'news',
    entityId: newsId,
    userId: authorId,
    metadata: {
      title,
      excerpt,
      authorId,
      authorName
    },
    io
  });
}

/**
 * Create activity when a book is uploaded
 */
export async function createBookActivity(
  bookId: string,
  title: string,
  authorName: string,
  uploaderId: string,
  uploaderName: string,
  coverUrl: string,
  io?: SocketIOServer
): Promise<void> {
  await createActivity({
    type: 'book',
    entityId: bookId,
    userId: uploaderId,
    bookId,
    metadata: {
      title,
      authorName,
      coverUrl,
      uploaderId,
      uploaderName
    },
    io
  });
}

/**
 * Create activity when a comment is posted
 */
export async function createCommentActivity(
  commentId: string,
  content: string,
  authorId: string,
  authorName: string,
  targetUserId: string | undefined,
  newsId: string | undefined,
  newsTitle: string | undefined,
  bookId: string | undefined,
  bookTitle: string | undefined,
  io?: SocketIOServer
): Promise<void> {
  await createActivity({
    type: 'comment',
    entityId: commentId,
    userId: authorId,
    targetUserId,
    bookId,
    metadata: {
      content,
      authorId,
      authorName,
      newsId,
      newsTitle,
      bookId,
      bookTitle
    },
    io
  });
}

/**
 * Create activity when a review is posted
 */
export async function createReviewActivity(
  reviewId: string,
  content: string,
  rating: number,
  authorId: string,
  authorName: string,
  bookId: string,
  bookTitle: string,
  io?: SocketIOServer
): Promise<void> {
  await createActivity({
    type: 'review',
    entityId: reviewId,
    userId: authorId,
    bookId,
    metadata: {
      content,
      rating,
      authorId,
      authorName,
      bookId,
      bookTitle
    },
    io
  });
}

/**
 * Update activity metadata
 */
export async function updateActivity(
  entityId: string,
  metadata: Partial<ActivityMetadata>,
  io?: SocketIOServer
): Promise<void> {
  try {
    await storage.updateActivityMetadata(entityId, metadata);
    console.log(`[STREAM] Updated activity metadata for ${entityId}`);

    // Broadcast update via WebSocket
    if (io) {
      io.to('stream:global').emit('stream:activity-updated', {
        entityId,
        metadata
      });
    }
  } catch (error) {
    console.error('[STREAM] Error updating activity:', error);
    throw error;
  }
}

/**
 * Delete activity (soft delete)
 */
export async function deleteActivity(
  entityId: string,
  io?: SocketIOServer
): Promise<void> {
  try {
    await storage.softDeleteActivity(entityId);
    console.log(`[STREAM] Deleted activity ${entityId}`);

    // Broadcast deletion via WebSocket
    if (io) {
      io.to('stream:global').emit('stream:activity-deleted', {
        entityId
      });
    }
  } catch (error) {
    console.error('[STREAM] Error deleting activity:', error);
    throw error;
  }
}
