// In-memory tracking for book chat online users
// This module is shared between routes/index.ts and other routes that need access to online users

export interface BookChatUserData {
  socketId: string;
  username: string;
  avatarUrl?: string;
  readingPosition?: {
    chapterIndex: number;
    pageInChapter: number;
    totalPagesInChapter: number;
  };
}

// Map<bookId, Map<userId, UserData>>
const bookChatOnlineUsers = new Map<string, Map<string, BookChatUserData>>();

// Typing users tracking: Map<bookId, Set<userId>>
const bookChatTypingUsers = new Map<string, Set<string>>();

export function getBookChatOnlineUsers(bookId: string): Array<{ id: string; username: string; avatarUrl?: string; readingPosition?: { chapterIndex: number; pageInChapter: number; totalPagesInChapter: number } }> {
  const users = bookChatOnlineUsers.get(bookId);
  if (!users) return [];
  
  return Array.from(users.entries()).map(([userId, data]) => ({
    id: userId,
    username: data.username,
    avatarUrl: data.avatarUrl,
    readingPosition: data.readingPosition,
  }));
}

export function getBookChatTypingUsers(bookId: string): string[] {
  const typingUsers = bookChatTypingUsers.get(bookId);
  if (!typingUsers) return [];
  return Array.from(typingUsers);
}

export function addBookChatUser(bookId: string, userId: string, socketId: string, username: string, avatarUrl?: string): void {
  if (!bookChatOnlineUsers.has(bookId)) {
    bookChatOnlineUsers.set(bookId, new Map());
  }
  
  bookChatOnlineUsers.get(bookId)!.set(userId, {
    socketId,
    username,
    avatarUrl,
  });
}

export function removeBookChatUser(bookId: string, userId: string): void {
  const users = bookChatOnlineUsers.get(bookId);
  if (users) {
    users.delete(userId);
    if (users.size === 0) {
      bookChatOnlineUsers.delete(bookId);
    }
  }
  
  // Also clean up typing users
  const typingUsers = bookChatTypingUsers.get(bookId);
  if (typingUsers) {
    typingUsers.delete(userId);
    if (typingUsers.size === 0) {
      bookChatTypingUsers.delete(bookId);
    }
  }
}

export function updateBookChatUserPosition(
  bookId: string,
  userId: string,
  chapterIndex: number,
  pageInChapter: number,
  totalPagesInChapter: number
): void {
  const users = bookChatOnlineUsers.get(bookId);
  if (users && users.has(userId)) {
    const userData = users.get(userId)!;
    userData.readingPosition = { chapterIndex, pageInChapter, totalPagesInChapter };
  }
}

export function setBookChatTyping(bookId: string, userId: string, typing: boolean): void {
  if (!bookChatTypingUsers.has(bookId)) {
    bookChatTypingUsers.set(bookId, new Set());
  }
  
  const typingUsers = bookChatTypingUsers.get(bookId)!;
  if (typing) {
    typingUsers.add(userId);
  } else {
    typingUsers.delete(userId);
  }
}

export function isUserOnline(bookId: string, userId: string): boolean {
  const users = bookChatOnlineUsers.get(bookId);
  return users ? users.has(userId) : false;
}

export function getOnlineUsersCount(bookId: string): number {
  const users = bookChatOnlineUsers.get(bookId);
  return users ? users.size : 0;
}
