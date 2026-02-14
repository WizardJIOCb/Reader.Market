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
  author_name?: string;
  author_avatar?: string;
  content_preview?: string;
  view_count?: number;
  comment_count?: number;
  reaction_count?: number;
  reactions?: any[];
}

interface BookActivityMetadata {
  title: string;
  authorName?: string;
  author_name?: string;
  coverUrl?: string;
  cover_url?: string;
  videoCoverUrl?: string;
  uploaderId: string;
  uploaderName?: string;
  uploader_name?: string;
  uploader_avatar?: string;
  uploader_rating?: number;
  genre?: string;
  average_rating?: number;
  reaction_count?: number;
  comment_count?: number;
  review_count?: number;
  reactions?: any[];
}

interface CommentActivityMetadata {
  content: string;
  content_preview?: string;
  authorId: string;
  author_name?: string;
  username?: string;
  author_avatar?: string;
  newsId?: string;
  news_id?: string;
  newsTitle?: string;
  news_title?: string;
  bookId?: string;
  book_id?: string;
  bookTitle?: string;
  book_title?: string;
  parentCommentId?: string;
  reactions?: any[];
}

interface ReviewActivityMetadata {
  content: string;
  content_preview?: string;
  rating?: number;
  authorId: string;
  authorName?: string;
  author_name?: string;
  author_avatar?: string;
  bookId: string;
  book_id?: string;
  bookTitle?: string;
  book_title?: string;
  reactions?: any[];
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
      content_preview: excerpt,
      authorId,
      authorName,
      author_name: authorName,
      view_count: 0,
      comment_count: 0,
      reaction_count: 0
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
  videoCoverUrl?: string,
  uploaderAvatar?: string,
  uploaderRating?: number,
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
      author_name: authorName,
      coverUrl,
      cover_url: coverUrl,
      videoCoverUrl,
      uploaderId,
      uploaderName,
      uploader_name: uploaderName,
      uploader_avatar: uploaderAvatar,
      uploader_rating: uploaderRating
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
  parentCommentId: string | undefined,
  authorAvatar: string | undefined,
  io?: SocketIOServer
): Promise<void> {
  // Fetch reactions for this comment to include in activity metadata
  let reactions: any[] = [];
  try {
    const rawReactions = await storage.getReactions(commentId, 'comment');
    
    // Group and aggregate reactions by emoji
    const groupedReactions: Record<string, any[]> = {};
    rawReactions.forEach((reaction: any) => {
      const emoji = reaction.emoji;
      if (!groupedReactions[emoji]) {
        groupedReactions[emoji] = [];
      }
      groupedReactions[emoji].push(reaction);
    });
    
    // Create aggregated reactions array
    Object.entries(groupedReactions).forEach(([emoji, reactionList]: [string, any[]]) => {
      reactions.push({
        emoji,
        count: reactionList.length,
        userReacted: false // We don't know current user at creation time
      });
    });
  } catch (error) {
    console.error('[STREAM] Error fetching comment reactions:', error);
  }

  await createActivity({
    type: 'comment',
    entityId: commentId,
    userId: authorId,
    targetUserId,
    bookId,
    metadata: {
      content,
      content_preview: content,
      authorId,
      author_name: authorName,
      username: authorName, // Use same value for username
      author_avatar: authorAvatar,
      newsId,
      news_title: newsTitle,
      bookId,
      book_title: bookTitle,
      parentCommentId,
      reactions
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
  // Fetch reactions for this review to include in activity metadata
  let reactions: any[] = [];
  try {
    const rawReactions = await storage.getReactions(reviewId, 'review');
    
    // Group and aggregate reactions by emoji
    const groupedReactions: Record<string, any[]> = {};
    rawReactions.forEach((reaction: any) => {
      const emoji = reaction.emoji;
      if (!groupedReactions[emoji]) {
        groupedReactions[emoji] = [];
      }
      groupedReactions[emoji].push(reaction);
    });
    
    // Create aggregated reactions array
    Object.entries(groupedReactions).forEach(([emoji, reactionList]: [string, any[]]) => {
      reactions.push({
        emoji,
        count: reactionList.length,
        userReacted: false
      });
    });
  } catch (error) {
    console.error('[STREAM] Error fetching review reactions:', error);
  }

  await createActivity({
    type: 'review',
    entityId: reviewId,
    userId: authorId,
    bookId,
    metadata: {
      content,
      content_preview: content,
      rating,
      authorId,
      author_name: authorName,
      bookId,
      book_title: bookTitle,
      reactions
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
        id: entityId
      });
    }
  } catch (error) {
    console.error('[STREAM] Error deleting activity:', error);
    throw error;
  }
}
