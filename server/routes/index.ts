import type { Express } from "express";
import { storage } from "../storage";
import { createBooksRouter } from "./books.routes";
import { createProfileRouter } from "./profile.routes";
import { createUsersRouter } from "./users.routes";
import { createAdminRouter } from "./admin.routes";
import { createCommentsRouter } from "./comments.routes";
import { createReviewsRouter } from "./reviews.routes";
import { createBookmarksRouter } from "./bookmarks.routes";
import { createNewsRouter } from "./news.routes";
import { createMessagesRouter } from "./messages.routes";
import { createShelvesRouter } from "./shelves.routes";
import { createHealthRouter } from "./health.routes";
import { createGitRouter } from "./git.routes";
import { createPageViewRouter } from "./page-view.routes";
import { createMiscRouter } from "./misc.routes";
import { createAuthRouter } from "./auth.routes";
import { createGroupsRouter } from "./groups.routes";
import { createChannelMessagesRouter } from "./channel-messages.routes";
import { createNotificationsRouter } from "./notifications.routes";
import { createUploadsRouter } from "./uploads.routes";
import { createStreamsRouter } from "./streams.routes";

export function registerRoutes(app: Express) {
  app.use("/api/books", createBooksRouter(storage));
  app.use("/api/profile", createProfileRouter(storage));
  app.use("/api/users", createUsersRouter(storage));
  app.use("/api/admin", createAdminRouter(storage));
  app.use("/api/comments", createCommentsRouter(storage));
  app.use("/api/reviews", createReviewsRouter(storage));
  app.use("/api/bookmarks", createBookmarksRouter(storage));
  app.use("/api/news", createNewsRouter(storage));
  app.use("/api/messages", createMessagesRouter(storage));
  app.use("/api/shelves", createShelvesRouter(storage));
  
  // Additional route modules
  app.use("/api/health", createHealthRouter());
  app.use("/api", createGitRouter()); // Git routes don't have a specific prefix
  app.use("/api/page-view", createPageViewRouter());
  app.use("/api", createMiscRouter()); // Misc routes like /popular-books and /public/users
  app.use("/api/auth", createAuthRouter());
  app.use("/api/groups", createGroupsRouter());
  app.use("/api/groups", createChannelMessagesRouter()); // Channel messages routes
  app.use("/api/notifications", createNotificationsRouter());
  app.use("/api/uploads", createUploadsRouter());
  app.use("/api/stream", createStreamsRouter());
  
  // More route modules will be added here as we migrate them
}