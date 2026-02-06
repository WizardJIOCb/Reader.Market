import { db } from '../db';
import { messages, conversations, users, messageReactions, userChannelReadPositions } from '@shared/schema';
import { eq, and, desc, asc, count, sql, or, ilike, like, inArray } from 'drizzle-orm';

export interface MessagesServiceInterface {
  // Conversations
  createConversation(participants: string[]): Promise<any>;
  getConversations(userId: string, limit?: number, offset?: number): Promise<any[]>;
  getConversation(conversationId: string, userId: string): Promise<any | null>;
  addParticipantsToConversation(conversationId: string, participantIds: string[]): Promise<any>;
  removeParticipantFromConversation(conversationId: string, participantId: string): Promise<any>;
  deleteConversation(conversationId: string): Promise<void>;

  // Messages
  sendMessage(conversationId: string, senderId: string, content: string, attachments?: any[]): Promise<any>;
  getMessages(conversationId: string, userId: string, limit?: number, offset?: number): Promise<any[]>;
  updateMessage(messageId: string, content: string, userId: string): Promise<any>;
  deleteMessage(messageId: string, userId: string): Promise<boolean>;
  getMessage(messageId: string, userId: string): Promise<any | null>;

  // Message Reactions
  addMessageReaction(messageId: string, userId: string, emoji: string): Promise<void>;
  removeMessageReaction(messageId: string, userId: string, emoji: string): Promise<void>;
  getMessageReactions(messageId: string): Promise<any[]>;

  // Read Positions
  updateReadPosition(userId: string, conversationId: string, messageId: string): Promise<any>;
  getLastReadPosition(userId: string, conversationId: string): Promise<string | null>;
}

export function createMessagesService() {
  return {
    // Conversations
    async createConversation(participants: string[]) {
      try {
        if (participants.length !== 2) {
          throw new Error('Only 2-person conversations are supported with current schema');
        }
        
        const [user1Id, user2Id] = participants;
        
        // Check if a conversation between these two users already exists
        const existingConversations = await db
          .select({
            id: conversations.id,
            user1Id: conversations.user1Id,
            user2Id: conversations.user2Id
          })
          .from(conversations);
          
        for (const conv of existingConversations) {
          if ((conv.user1Id === user1Id && conv.user2Id === user2Id) ||
              (conv.user1Id === user2Id && conv.user2Id === user1Id)) {
            return conv; // Return existing conversation
          }
        }

        // Create new conversation
        const [conversation] = await db.insert(conversations)
          .values({
            user1Id,
            user2Id,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        return conversation;
      } catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
      }
    },

    async getConversations(userId: string, limit: number = 20, offset: number = 0) {
      try {
        const userConversations = await db
          .select({
            id: conversations.id,
            user1Id: conversations.user1Id,
            user2Id: conversations.user2Id,
            lastMessageId: conversations.lastMessageId,
            createdAt: conversations.createdAt,
            updatedAt: conversations.updatedAt,
            lastMessage: {
              id: messages.id,
              content: messages.content,
              senderId: messages.senderId,
              createdAt: messages.createdAt,
              updatedAt: messages.updatedAt
            }
          })
          .from(conversations)
          .leftJoin(messages, eq(messages.id, conversations.lastMessageId))
          .where(or(
            eq(conversations.user1Id, userId),
            eq(conversations.user2Id, userId)
          ))
          .orderBy(desc(conversations.updatedAt))
          .limit(limit)
          .offset(offset);

        // Add participant details to each conversation
        const processedConversations = await Promise.all(userConversations.map(async (conv) => {
          const participants = await db
            .select({
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            })
            .from(users)
            .where(inArray(users.id, [conv.user1Id, conv.user2Id]));
          
          return {
            ...conv,
            participants
          };
        }));

        return processedConversations;
      } catch (error) {
        console.error('Error getting conversations:', error);
        throw error;
      }
    },

    async getConversation(conversationId: string, userId: string) {
      try {
        const [conversation] = await db
          .select()
          .from(conversations)
          .where(and(
            eq(conversations.id, conversationId),
            sql`${userId} = ANY(${conversations.participantIds})`
          ));

        if (!conversation) {
          return null;
        }

        // Get participants
        const participants = await db
          .select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl
          })
          .from(users)
          .where(inArray(users.id, conversation.participantIds as string[]));

        return {
          ...conversation,
          participants
        };
      } catch (error) {
        console.error('Error getting conversation:', error);
        throw error;
      }
    },

    async addParticipantsToConversation(conversationId: string, participantIds: string[]) {
      try {
        const [conversation] = await db
          .select({
            participantIds: conversations.participantIds
          })
          .from(conversations)
          .where(eq(conversations.id, conversationId));

        if (!conversation) {
          throw new Error('Conversation not found');
        }

        // Combine existing and new participants, ensuring uniqueness
        const allParticipants = Array.from(
          new Set([...(conversation.participantIds as string[] || []), ...participantIds])
        );

        await db
          .update(conversations)
          .set({
            participantIds: allParticipants,
            updatedAt: new Date()
          })
          .where(eq(conversations.id, conversationId));
      } catch (error) {
        console.error('Error adding participants to conversation:', error);
        throw error;
      }
    },

    async removeParticipantFromConversation(conversationId: string, participantId: string) {
      try {
        const [conversation] = await db
          .select({
            participantIds: conversations.participantIds
          })
          .from(conversations)
          .where(eq(conversations.id, conversationId));

        if (!conversation) {
          throw new Error('Conversation not found');
        }

        // Remove participant from list
        const updatedParticipants = (conversation.participantIds as string[] || []).filter(
          (id: string) => id !== participantId
        );

        await db
          .update(conversations)
          .set({
            participantIds: updatedParticipants,
            updatedAt: new Date()
          })
          .where(eq(conversations.id, conversationId));
      } catch (error) {
        console.error('Error removing participant from conversation:', error);
        throw error;
      }
    },

    async deleteConversation(conversationId: string) {
      try {
        // Delete all messages in the conversation
        await db
          .delete(messages)
          .where(eq(messages.conversationId, conversationId));

        // Delete the conversation
        await db
          .delete(conversations)
          .where(eq(conversations.id, conversationId));
      } catch (error) {
        console.error('Error deleting conversation:', error);
        throw error;
      }
    },

    // Messages
    async sendMessage(conversationId: string, senderId: string, content: string, attachments?: any[]) {
      try {
        const [message] = await db.insert(messages)
          .values({
            conversationId,
            senderId,
            content,
            attachmentUrls: attachments || [],
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        // Update conversation's updated_at timestamp
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));

        return message;
      } catch (error) {
        console.error('Error sending message:', error);
        throw error;
      }
    },

    async getMessages(conversationId: string, userId: string, limit: number = 50, offset: number = 0) {
      try {
        // First verify user is part of conversation
        const [conversation] = await db
          .select({
            participantIds: conversations.participantIds
          })
          .from(conversations)
          .where(eq(conversations.id, conversationId));

        if (!conversation || !(conversation.participantIds as string[]).includes(userId)) {
          throw new Error('User not part of conversation');
        }

        const messagesResult = await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            senderId: messages.senderId,
            content: messages.content,
            attachmentUrls: messages.attachmentUrls,
            createdAt: messages.createdAt,
            updatedAt: messages.updatedAt,
            sender: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(messages)
          .leftJoin(users, eq(users.id, messages.senderId))
          .where(eq(messages.conversationId, conversationId))
          .orderBy(desc(messages.createdAt))
          .limit(limit)
          .offset(offset);

        return messagesResult;
      } catch (error) {
        console.error('Error getting messages:', error);
        throw error;
      }
    },

    async updateMessage(messageId: string, content: string, userId: string) {
      try {
        const [existingMessage] = await db
          .select({
            senderId: messages.senderId,
            conversationId: messages.conversationId
          })
          .from(messages)
          .where(eq(messages.id, messageId));

        if (!existingMessage || existingMessage.senderId !== userId) {
          throw new Error('Unauthorized or message not found');
        }

        const [updatedMessage] = await db
          .update(messages)
          .set({
            content,
            updatedAt: new Date()
          })
          .where(eq(messages.id, messageId))
          .returning();

        return updatedMessage;
      } catch (error) {
        console.error('Error updating message:', error);
        throw error;
      }
    },

    async deleteMessage(messageId: string, userId: string) {
      try {
        const [existingMessage] = await db
          .select({
            senderId: messages.senderId,
            conversationId: messages.conversationId
          })
          .from(messages)
          .where(eq(messages.id, messageId));

        if (!existingMessage) {
          return false;
        }

        // Check if user is the sender or an admin
        if (existingMessage.senderId !== userId) {
          const [user] = await db
            .select({
              accessLevel: users.accessLevel
            })
            .from(users)
            .where(eq(users.id, userId));

          if (!user || (user.accessLevel !== 'admin' && user.accessLevel !== 'moder')) {
            throw new Error('Unauthorized');
          }
        }

        await db
          .delete(messages)
          .where(eq(messages.id, messageId));

        return true;
      } catch (error) {
        console.error('Error deleting message:', error);
        if (error instanceof Error && error.message === 'Unauthorized') {
          throw error;
        }
        return false;
      }
    },

    async getMessage(messageId: string, userId: string) {
      try {
        const message = await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            senderId: messages.senderId,
            content: messages.content,
            attachmentUrls: messages.attachmentUrls,
            createdAt: messages.createdAt,
            updatedAt: messages.updatedAt,
            sender: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(messages)
          .leftJoin(users, eq(users.id, messages.senderId))
          .where(eq(messages.id, messageId));

        if (!message.length) {
          return null;
        }

        // Verify user has access to the conversation
        const [conversation] = await db
          .select({
            participantIds: conversations.participantIds
          })
          .from(conversations)
          .where(eq(conversations.id, message[0].conversationId));

        if (!conversation || !(conversation.participantIds as string[]).includes(userId)) {
          throw new Error('Unauthorized');
        }

        return message[0];
      } catch (error) {
        console.error('Error getting message:', error);
        throw error;
      }
    },

    // Message Reactions
    async addMessageReaction(messageId: string, userId: string, emoji: string) {
      try {
        // Check if reaction already exists
        const [existingReaction] = await db
          .select()
          .from(messageReactions)
          .where(and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.userId, userId),
            eq(messageReactions.emoji, emoji)
          ));

        if (existingReaction) {
          // Update existing reaction
          await db
            .update(messageReactions)
            .set({ updatedAt: new Date() })
            .where(eq(messageReactions.id, existingReaction.id));
        } else {
          // Create new reaction
          await db.insert(messageReactions)
            .values({
              messageId,
              userId,
              emoji,
              createdAt: new Date(),
              updatedAt: new Date()
            });
        }
      } catch (error) {
        console.error('Error adding message reaction:', error);
        throw error;
      }
    },

    async removeMessageReaction(messageId: string, userId: string, emoji: string) {
      try {
        await db
          .delete(messageReactions)
          .where(and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.userId, userId),
            eq(messageReactions.emoji, emoji)
          ));
      } catch (error) {
        console.error('Error removing message reaction:', error);
        throw error;
      }
    },

    async getMessageReactions(messageId: string) {
      try {
        const reactions = await db
          .select({
            id: messageReactions.id,
            userId: messageReactions.userId,
            emoji: messageReactions.emoji,
            createdAt: messageReactions.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl
            }
          })
          .from(messageReactions)
          .leftJoin(users, eq(users.id, messageReactions.userId))
          .where(eq(messageReactions.messageId, messageId));

        // Group reactions by emoji
        const groupedReactions: any[] = [];
        const emojiMap = new Map();

        reactions.forEach(reaction => {
          if (!emojiMap.has(reaction.emoji)) {
            emojiMap.set(reaction.emoji, {
              emoji: reaction.emoji,
              count: 0,
              users: []
            });
            groupedReactions.push(emojiMap.get(reaction.emoji));
          }

          const group = emojiMap.get(reaction.emoji);
          group.count++;
          group.users.push(reaction.user);
        });

        return groupedReactions;
      } catch (error) {
        console.error('Error getting message reactions:', error);
        throw error;
      }
    },

    // Read Positions
    async updateReadPosition(userId: string, conversationId: string, messageId: string) {
      try {
        const [position] = await db.insert(userChannelReadPositions)
          .values({
            userId,
            channelId: conversationId, // Using channelId for consistency with existing schema
            lastReadMessageId: messageId,
            lastReadAt: new Date()
          })
          .onConflictDoUpdate({
            target: [userChannelReadPositions.userId, userChannelReadPositions.channelId],
            set: {
              lastReadMessageId: messageId,
              lastReadAt: new Date()
            }
          })
          .returning();

        return position;
      } catch (error) {
        console.error('Error updating read position:', error);
        throw error;
      }
    },

    async getLastReadPosition(userId: string, conversationId: string) {
      try {
        const [position] = await db
          .select({
            lastReadMessageId: userChannelReadPositions.lastReadMessageId
          })
          .from(userChannelReadPositions)
          .where(and(
            eq(userChannelReadPositions.userId, userId),
            eq(userChannelReadPositions.channelId, conversationId)
          ));

        return position ? position.lastReadMessageId : null;
      } catch (error) {
        console.error('Error getting read position:', error);
        throw error;
      }
    }
  } as MessagesServiceInterface;
}