export type ArticleTagDTO = { id: string; axis: string; name: string; slug: string };

export type ArticleAuthorDTO = {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type ArticleCardDTO = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  section: string | null;
  format: string | null;
  lang: string;
  views: number;
  commentsCount: number;
  createdAt: string;      // ISO
  publishedAt: string | null; // ISO

  author?: ArticleAuthorDTO;   // <-- was mandatory, now optional
  tags: ArticleTagDTO[];
  isReadLater?: boolean;
  bookLink?: { role: "primary" | "in_list" | "mentioned"; sortOrder: number };
};