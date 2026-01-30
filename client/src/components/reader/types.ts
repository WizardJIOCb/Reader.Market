// Reader Types and Interfaces

export interface PageMapItem {
  html: string;      // HTML страницы
  text: string;      // plainText страницы (нормализованный как в ReaderEngine)
  startChar: number; // offset в chapter.plainText (включая)
  endChar: number;   // offset в chapter.plainText (исключая)
}

export interface ReadingLocatorV2 {
  v: 2;
  bookId: string;
  chapterIndex: number;

  // главный ключ:
  charOffsetInBook: number;
  charOffsetInChapter: number;

  percentage: number;

  // подсказки/страховки:
  pageHintInChapter?: number;
  totalPagesHintInChapter?: number;
  anchorText?: string;

  viewport?: {
    w: number;
    h: number;
    fontSize: number;
    lineHeight: number;
    margins: number;
    fontFamily: string;
    viewMode: 'paginated' | 'scroll';
  };

  updatedAt: string; // ISO
}

export interface Position {
  /** Character offset in the book content */
  charOffset: number;
  /** CFI (Canonical Fragment Identifier) for EPUB */
  cfi?: string;
  /** Chapter/section index */
  chapterIndex: number;
  /** Page number within current view */
  pageInChapter: number;
  /** Total pages in chapter */
  totalPagesInChapter: number;
  /** Percentage through the book (0-100) */
  percentage: number;
}

export interface Chapter {
  /** Chapter index */
  index: number;
  /** Chapter title */
  title: string;
  /** HTML content of the chapter */
  content: string;
  /** Plain text content */
  plainText: string;
  /** Character count */
  charCount: number;
  /** Start offset in full book */
  startOffset: number;
  /** End offset in full book */
  endOffset: number;
}

export interface BookContent {
  /** Book title */
  title: string;
  /** Book author */
  author: string;
  /** Book description/annotation */
  description?: string;
  /** Cover image as base64 or URL */
  coverImage?: string;
  /** Array of chapters */
  chapters: Chapter[];
  /** Total character count */
  totalChars: number;
  /** Book metadata */
  metadata: BookMetadata;
}

export interface BookMetadata {
  /** Original file format */
  format: BookFormat;
  /** Language code (ru, en, etc.) */
  language?: string;
  /** Publisher */
  publisher?: string;
  /** Publication year */
  year?: number;
  /** Genre/category */
  genre?: string;
  /** ISBN if available */
  isbn?: string;
}

export type BookFormat = 'fb2' | 'epub' | 'txt' | 'pdf' | 'mobi' | 'azw3' | 'unknown';

export interface ReaderSettings {
  /** Font size in pixels */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Line height multiplier */
  lineHeight: number;
  /** Theme: light or dark */
  theme: 'light' | 'dark' | 'sepia';
  /** Page margins in pixels */
  margins: number;
  /** Text alignment */
  textAlign: 'left' | 'justify';
  /** Paragraph indent in em */
  paragraphIndent: number;
  /** View mode */
  viewMode: 'paginated' | 'scroll';
  /** Show progress bar */
  showProgressBar: boolean;
  /** Auto-close bookmarks panel on bookmark click */
  autoCloseBookmarksPanel: boolean;
  /** Navigation zone position: inside book content or outside (screen edges) */
  navigationZonePosition: 'inside' | 'outside';
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 16,
  fontFamily: 'Georgia, serif',
  lineHeight: 1.6,
  theme: 'sepia',
  margins: 24,
  textAlign: 'justify',
  paragraphIndent: 1.5,
  viewMode: 'paginated',
  showProgressBar: true,
  autoCloseBookmarksPanel: true,
  navigationZonePosition: 'inside',
};

export interface SearchResult {
  /** Chapter index where found */
  chapterIndex: number;
  /** Character offset in chapter */
  charOffset: number;
  /** Matched text */
  matchedText: string;
  /** Context around the match */
  context: string;
  /** Position for navigation */
  position: Position;
}

export interface TextSelection {
  /** Selected text */
  text: string;
  /** Start position */
  start: Position;
  /** End position */
  end: Position;
  /** Bounding rectangle for positioning popover */
  rect?: DOMRect;
  /** Cloned Range object for selection restoration */
  range?: Range;
}

export interface Bookmark {
  id: string;
  bookId: string;
  userId: string;
  title: string;
  position: Position;
  textPreview?: string;
  isPublic: boolean;
  viewCount: number;
  jumpCount: number;
  createdAt: Date;
}

// Reader Events
export interface ReaderEvents {
  /** Fired when book is loaded and ready */
  onReady: (content: BookContent) => void;
  /** Fired when position changes */
  onPositionChange: (position: Position) => void;
  /** Fired when text is selected */
  onTextSelect: (selection: TextSelection | null) => void;
  /** Fired on error */
  onError: (error: Error) => void;
  /** Fired when chapter changes */
  onChapterChange: (chapter: Chapter) => void;
}

// Active Reader (for social features)
export interface ActiveReader {
  userId: string;
  username: string;
  avatarUrl?: string;
  position: Position;
  lastHeartbeat: Date;
}

// Book Chat Message
export interface BookChatMessage {
  id: string;
  bookId: string;
  groupId?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  textSelection?: {
    start: string;
    end: string;
    preview: string;
  };
  createdAt: Date;
}

// Theme colors
export const THEME_COLORS = {
  light: {
    background: '#ffffff',
    text: '#1a1a1a',
    accent: '#3b82f6',
  },
  dark: {
    background: '#1a1a1a',
    text: '#e5e5e5',
    accent: '#60a5fa',
  },
  sepia: {
    background: '#f4ecd8',
    text: '#5c4b37',
    accent: '#8b7355',
  },
};
