import { db } from '../db';
import { discussions, discussionCategories, books } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export async function getOrCreateBookDiscussion(params: {
  bookId: string;
  userId: string; // who initiated (for createdById)
  defaultCategoryId?: string; // e.g. "Book Discussions"
}): Promise<any> {
  // First, get the book to use its title for the discussion
  const book = await db.query.books.findFirst({
    where: eq(books.id, params.bookId),
  });

  if (!book) {
    throw new Error('Book not found');
  }

  // Look for existing book discussion thread
  const existing = await db.query.discussions.findFirst({
    where: and(
      eq(discussions.bookId, params.bookId), 
      eq(discussions.kind, "book")
    ),
  });

  if (existing) return existing;

  // Create new discussion thread for the book
  // Handle race condition with unique index + catch conflict
  try {
    const created = await db.insert(discussions).values({
      kind: "book",
      bookId: params.bookId,
      categoryId: params.defaultCategoryId ?? null,
      title: `Discussion of "${book.title}" by ${book.author}`,
      createdById: params.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return created[0];
  } catch (e: any) {
    // If created in parallel, fetch again
    const retry = await db.query.discussions.findFirst({
      where: and(
        eq(discussions.bookId, params.bookId), 
        eq(discussions.kind, "book")
      ),
    });
    if (retry) return retry;
    throw e;
  }
}