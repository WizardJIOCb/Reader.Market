export interface BookmarkCollection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  isPublic: boolean;
  bookId?: string | null; // Deprecated: Use bookIds instead
  bookIds?: string[]; // New field for multiple books
  viewCount?: number; // Number of times collection has been viewed
  createdAt: string;
  updatedAt: string;
  bookmarkCount?: number;
  bookCount?: number; // Number of books in the collection
  isClone?: boolean;
  isOwn?: boolean;
  coverImageUrl?: string; // URL of the cover image for the collection
  // Owner information
  ownerId?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  ownerAvatarUrl?: string;
  ownerProfileRating?: number;
  // Associated books (for detail view)
  books?: Array<{
    id: string;
    title: string;
    author: string;
    coverImageUrl?: string;
  }>;
}

export interface BookmarkCollectionItem {
  id: string;
  collectionId: string;
  bookmarkId: string;
  addedAt: string;
}

export interface BookmarkCollectionWithBookmarks extends BookmarkCollection {
  bookmarks: BookmarkWithBookInfo[];
}

export interface BookmarkWithBookInfo {
  id: string;
  title: string;
  chapterIndex: number | null;
  percentage: number | null;
  selectedText: string | null;
  pageInChapter: number | null;
  clickCount?: number; // Number of times bookmark has been clicked
  createdAt: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverImageUrl: string | null;
}

export interface CreateBookmarkCollectionRequest {
  name: string;
  description?: string;
  color?: string;
  isPublic?: boolean;
}

export interface UpdateBookmarkCollectionRequest {
  name?: string;
  description?: string;
  color?: string;
  isPublic?: boolean;
  bookId?: string | null; // Deprecated: Use bookIds instead
  bookIds?: string[]; // New field for multiple books
}