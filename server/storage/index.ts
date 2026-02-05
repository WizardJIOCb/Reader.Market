import { db } from "./db";
import { createBooksStorage } from "./modules/books.storage";
import { createUsersStorage } from "./modules/users.storage";
import { createShelvesStorage } from "./modules/shelves.storage";
import { createReadingProgressStorage } from "./modules/readingProgress.storage";
import { createBookmarksStorage } from "./modules/bookmarks.storage";
import { createCommentsStorage } from "./modules/comments.storage";
import { createReviewsStorage } from "./modules/reviews.storage";
import type { Storage } from "./types";

// Temporary import of legacy storage until we fully migrate
import { createLegacyStorage } from "./legacy.storage";

// Combine all storage modules
export const storage = {
  ...createLegacyStorage(db),  // All existing methods from original storage
  ...createBooksStorage(db),   // Books-related methods
  ...createUsersStorage(db),   // User-related methods
  ...createShelvesStorage(db), // Shelves-related methods
  ...createReadingProgressStorage(db), // Reading progress methods
  ...createBookmarksStorage(db), // Bookmarks-related methods
  ...createCommentsStorage(db), // Comments-related methods
  ...createReviewsStorage(db), // Reviews-related methods
  // More modules will be added here as we migrate them
};

export type { Storage };