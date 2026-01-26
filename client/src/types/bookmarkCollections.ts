export interface BookmarkCollection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  bookmarkCount?: number;
  isClone?: boolean;
  isOwn?: boolean;
  // Owner information
  ownerId?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  ownerAvatarUrl?: string;
  ownerProfileRating?: number;
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
}