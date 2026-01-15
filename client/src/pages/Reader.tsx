import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';
import { booksApi, readerApi } from '@/lib/api';
import { useBookSplash } from '@/lib/bookSplashContext';
import { getSocket, joinBookChat, leaveBookChat, sendBookChatMessage, startBookChatTyping, stopBookChatTyping, deleteBookChatMessage, onSocketEvent } from '@/lib/socket';
import { Bookmark, Plus, Trash2, Brain, MessageCircle, Users, X, List, Search, Settings, Pencil, Send, Paperclip, Reply, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

// Reader Components
import {
  ReaderCore,
  ReaderCoreHandle,
  ReaderToolbar,
  DEFAULT_READER_SETTINGS,
  BookContent,
  Position,
  TextSelection,
  Chapter,
  SearchResult,
  THEME_COLORS,
} from '@/components/reader';
import type { ReaderSettings } from '@/components/reader/types';

// Legacy components
import { AISidebar } from '@/components/AISidebar';

// Book interface
interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverImageUrl?: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  genre?: string;
  publishedYear?: number;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

// Bookmark interface
interface BookmarkItem {
  id: string;
  title: string;
  chapterIndex: number;
  percentage: number;
  createdAt: Date;
  // Selected text info for highlighting on navigation
  selectedText?: string;
  pageInChapter?: number;
}

// Local storage keys
const READER_SETTINGS_KEY = 'reader-settings';
const BOOKMARKS_KEY = 'reader-bookmarks';

export default function Reader() {
  const [match, params] = useRoute('/read/:bookId/:position');
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const readerRef = useRef<ReaderCoreHandle>(null);
  const toastRef = useRef(toast);
  
  // Book state
  const [book, setBook] = useState<Book | null>(null);
  const [bookUrl, setBookUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Reader state
  const [bookContent, setBookContent] = useState<BookContent | null>(null);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPageOverall, setCurrentPageOverall] = useState(1);
  const [totalPagesOverall, setTotalPagesOverall] = useState(1);
  
  // Global splash screen context
  const { showSplash, hideSplash, isVisible: isSplashVisible } = useBookSplash();
  const loadStartTimeRef = useRef<number>(Date.now());
  const isDirectLoadRef = useRef<boolean>(false); // Track if this is a direct page load (refresh)
  
  // Safety timeout to ensure splash screen is always hidden after max time
  useEffect(() => {
    if (!isSplashVisible) return;
    
    const maxSplashTime = 3000; // Maximum splash display time (3 seconds)
    const safetyTimeout = setTimeout(() => {
      hideSplash();
    }, maxSplashTime);
    
    return () => clearTimeout(safetyTimeout);
  }, [isSplashVisible, hideSplash]);
  
  // Mobile viewport detection effect
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // UI state - single panel, no multiple selection
  type PanelType = 'toc' | 'search' | 'bookmarks' | 'settings' | 'ai' | 'chat' | null;
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  
  // Store selection range to restore it if browser clears it
  const selectionRangeRef = useRef<Range | null>(null);
  // Control popover visibility separately to allow delayed rendering
  const [showSelectionPopover, setShowSelectionPopover] = useState(false);
  
  // Bookmark highlight state (for showing orange highlight when navigating to bookmark)
  const [bookmarkHighlight, setBookmarkHighlight] = useState<{
    text: string;
    context?: string; // Surrounding text to find the correct occurrence
    chapterIndex: number;
    pageInChapter: number;
    fading: boolean;
  } | null>(null);
  const [bookmarkHighlightRect, setBookmarkHighlightRect] = useState<DOMRect | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  
  // Bookmark editing state
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editBookmarkTitle, setEditBookmarkTitle] = useState('');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [chatTab, setChatTab] = useState<'messages' | 'users'>('messages');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentMessageImages, setCurrentMessageImages] = useState<string[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  
  // Debounce refs for saving progress and settings
  const lastProgressSaveRef = useRef<number>(0);
  const lastSettingsSaveRef = useRef<number>(0);
  const progressSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const settingsSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDoneRef = useRef(false);
  
  // Settings
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem(READER_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_READER_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load reader settings:', e);
    }
    return DEFAULT_READER_SETTINGS;
  });
  
  const bookId = params?.bookId || '';
  const positionParam = params?.position || '';
  
  // Load bookmarks from API (authenticated) or localStorage (guest)
  useEffect(() => {
    if (!bookId) return;
    
    const loadBookmarks = async () => {
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        // Authenticated: fetch from API
        try {
          const response = await readerApi.getBookmarks(bookId);
          if (response.ok) {
            const data = await response.json();
            setBookmarks(data.map((b: any) => ({
              ...b,
              createdAt: new Date(b.createdAt),
            })));
            // Cache to localStorage
            localStorage.setItem(`${BOOKMARKS_KEY}-${bookId}`, JSON.stringify(data));
            return;
          }
        } catch (e) {
          console.error('Failed to load bookmarks from API:', e);
        }
      }
      
      // Guest or API failed: load from localStorage
      try {
        const saved = localStorage.getItem(`${BOOKMARKS_KEY}-${bookId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setBookmarks(parsed.map((b: any) => ({ ...b, createdAt: new Date(b.createdAt) })));
        }
      } catch (e) {
        console.error('Failed to load bookmarks from localStorage:', e);
      }
    };
    
    loadBookmarks();
  }, [bookId]);
  
  // Load chat messages and setup WebSocket listeners when chat panel opens
  useEffect(() => {
    if (!bookId) return;
    
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return; // Chat requires authentication
    
    // Join book chat room immediately when reader opens
    const socket = getSocket();
    if (socket?.connected) {
      joinBookChat(bookId);
    }
    
    // Load online users helper (used by presence update handlers)
    const loadOnlineUsers = async () => {
      try {
        const response = await readerApi.getOnlineUsers(bookId);
        if (response.ok) {
          const data = await response.json();
          setOnlineUsers(data);
        }
      } catch (e) {
        console.error('Failed to load online users:', e);
      }
    };
    
    const cleanupNewMessage = onSocketEvent('book-chat:new-message', (message) => {
      console.log('[BOOK CHAT] New message received:', message);
      console.log('[BOOK CHAT] attachmentUrls:', message.attachmentUrls);
      console.log('[BOOK CHAT] attachmentMetadata:', message.attachmentMetadata);
      console.log('[BOOK CHAT] quotedMessage:', message.quotedMessage);
      setChatMessages(prev => [...prev, message]);
      
      // Increment unread counter if chat panel is closed and message is from another user
      if (activePanel !== 'chat' && message.userId !== user?.id) {
        setUnreadChatCount(prev => prev + 1);
      }
    });
    
    const cleanupPresenceUpdate = onSocketEvent('book-chat:presence-update', async (data) => {
      if (data.action === 'joined') {
        // Reload online users to get updated list
        loadOnlineUsers();
      } else if (data.action === 'left') {
        setOnlineUsers(prev => prev.filter(u => u.id !== data.userId));
      }
    });
    
    const cleanupOnlineUsers = onSocketEvent('book-chat:online-users', (data) => {
      // Received initial online users list when joining
      loadOnlineUsers();
    });
    
    const cleanupTyping = onSocketEvent('book-chat:user-typing', (data) => {
      setTypingUsers(prev => {
        const updated = new Set(prev);
        if (data.typing) {
          updated.add(data.userId);
        } else {
          updated.delete(data.userId);
        }
        return updated;
      });
    });
    
    const cleanupDeleteMessage = onSocketEvent('book-chat:message-deleted', (data) => {
      setChatMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });
    
    return () => {
      // Leave chat room when panel closes
      leaveBookChat(bookId);
      cleanupNewMessage();
      cleanupPresenceUpdate();
      cleanupOnlineUsers();
      cleanupDeleteMessage();
      cleanupTyping();
    };
  }, [bookId, activePanel, user?.id]);
  
  // Load messages and users when chat panel is opened
  useEffect(() => {
    if (!bookId || activePanel !== 'chat') return;
    
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return;
    
    // Load initial messages
    const loadChatMessages = async () => {
      try {
        const response = await readerApi.getChatMessages(bookId);
        if (response.ok) {
          const data = await response.json();
          setChatMessages(data);
        }
      } catch (e) {
        console.error('Failed to load chat messages:', e);
      }
    };
    
    // Load online users
    const loadOnlineUsers = async () => {
      try {
        const response = await readerApi.getOnlineUsers(bookId);
        if (response.ok) {
          const data = await response.json();
          setOnlineUsers(data);
        }
      } catch (e) {
        console.error('Failed to load online users:', e);
      }
    };
    
    loadChatMessages();
    loadOnlineUsers();
  }, [bookId, activePanel]);
  
  // Load reading progress and settings on mount (for authenticated users)
  useEffect(() => {
    if (!bookId || !user || initialLoadDoneRef.current) return;
    
    const loadProgressAndSettings = async () => {
      try {
        // Load reading progress
        const progressResponse = await readerApi.getProgress(bookId);
        if (progressResponse.ok) {
          const progress = await progressResponse.json();
          // Store for later use when reader is ready
          localStorage.setItem(`reading-progress-${bookId}`, JSON.stringify(progress));
        }
        
        // Load settings
        const settingsResponse = await readerApi.getSettings(bookId);
        if (settingsResponse.ok) {
          const apiSettings = await settingsResponse.json();
          setSettings(prev => ({ ...prev, ...apiSettings }));
          localStorage.setItem(`${READER_SETTINGS_KEY}-${bookId}`, JSON.stringify(apiSettings));
        }
      } catch (e) {
        console.error('Failed to load progress/settings from API:', e);
      }
      initialLoadDoneRef.current = true;
    };
    
    loadProgressAndSettings();
  }, [bookId, user]);
  
  // Update settings (with API sync for authenticated users)
  const updateSettings = useCallback((newSettings: Partial<ReaderSettings>) => {
    setSettings((prev: ReaderSettings) => {
      const updated = { ...prev, ...newSettings };
      
      // Save to localStorage immediately
      try {
        localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(updated));
        if (bookId) {
          localStorage.setItem(`${READER_SETTINGS_KEY}-${bookId}`, JSON.stringify(updated));
        }
      } catch (e) {
        console.error('Failed to save settings to localStorage:', e);
      }
      
      // Debounced save to API for authenticated users
      if (user && bookId) {
        if (settingsSaveTimeoutRef.current) {
          clearTimeout(settingsSaveTimeoutRef.current);
        }
        settingsSaveTimeoutRef.current = setTimeout(async () => {
          try {
            await readerApi.updateSettings(bookId, updated);
          } catch (e) {
            console.error('Failed to sync settings to API:', e);
          }
        }, 2000);
      }
      
      return updated;
    });
  }, [user, bookId]);
  
  // Save reading progress on unmount and page unload
  useEffect(() => {
    const saveProgressToApi = () => {
      if (user && bookId) {
        const savedProgress = localStorage.getItem(`reading-progress-${bookId}`);
        if (savedProgress) {
          try {
            const progress = JSON.parse(savedProgress);
            const token = localStorage.getItem('authToken');
            if (token) {
              // Use fetch with keepalive for reliable delivery during page unload
              fetch(`/api/books/${bookId}/reading-progress`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(progress),
                keepalive: true,
              }).catch(() => {}); // Ignore errors on unload
            }
          } catch (e) {
            // Ignore errors on unload
          }
        }
      }
    };
    
    // Save on page unload (browser close, refresh, navigate away)
    window.addEventListener('beforeunload', saveProgressToApi);
    
    return () => {
      window.removeEventListener('beforeunload', saveProgressToApi);
      
      // Clear any pending timeouts
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
      }
      if (settingsSaveTimeoutRef.current) {
        clearTimeout(settingsSaveTimeoutRef.current);
      }
      
      // Final save to API on unmount (for SPA navigation)
      if (user && bookId) {
        const savedProgress = localStorage.getItem(`reading-progress-${bookId}`);
        if (savedProgress) {
          try {
            const progress = JSON.parse(savedProgress);
            readerApi.updateProgress(bookId, progress).catch(() => {});
          } catch (e) {
            // Ignore errors
          }
        }
      }
    };
  }, [user, bookId]);
  
  // Update bookUrl when book changes
  useEffect(() => {
    if (book?.filePath) {
      setBookUrl(`/${book.filePath}`);
    } else {
      setBookUrl('');
    }
  }, [book]);
  
  // Tracking refs
  const readerOpenTrackedRef = useRef<Set<string>>(new Set());
  const readerFetchInProgressRef = useRef<Set<string>>(new Set());
  const prevBookIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  
  // Fetch book data
  useEffect(() => {
    if (prevBookIdRef.current !== bookId) {
      readerOpenTrackedRef.current.delete(bookId);
      prevBookIdRef.current = bookId;
    }
    
    const fetchBook = async () => {
      if (!bookId) return;
      if (readerFetchInProgressRef.current.has(bookId)) return;
      
      readerFetchInProgressRef.current.add(bookId);
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await booksApi.getBookById(bookId);
        if (!response.ok) throw new Error('Failed to fetch book');
        
        const bookData = await response.json();
        setBook(bookData);
        
        // Show splash screen on direct page load (refresh or direct URL access)
        if (!isSplashVisible) {
          isDirectLoadRef.current = true; // Mark as direct load for longer splash display
          showSplash({
            id: bookData.id,
            title: bookData.title,
            author: bookData.author,
            coverImageUrl: bookData.coverImageUrl,
            description: bookData.description,
            rating: bookData.rating,
          });
        }
        
        // Track view
        const token = localStorage.getItem('authToken');
        if (token && !readerOpenTrackedRef.current.has(bookId)) {
          readerOpenTrackedRef.current.add(bookId);
          fetch(`/api/books/${bookId}/track-view`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ viewType: 'reader_open' }),
          }).catch(console.error);
        }
      } catch (err) {
        console.error('Error fetching book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
        // Hide splash screen immediately on error
        hideSplash();
        toastRef.current({
          title: "Ошибка",
          description: "Не удалось загрузить книгу",
          variant: "destructive",
        });
      } finally {
        readerFetchInProgressRef.current.delete(bookId);
        setLoading(false);
      }
    };
    
    fetchBook();
    return () => { readerFetchInProgressRef.current.delete(bookId); };
  }, [bookId]);
  
  // Reader callbacks
  const handleReaderReady = useCallback(async (content: BookContent) => {
    setBookContent(content);
    if (content.chapters.length > 0) {
      setCurrentChapter(content.chapters[0]);
    }
    
    // Restore reading progress - try API first (for authenticated users), then localStorage
    const restoreProgress = async () => {
      let progress = null;
      
      // Try to load from API for authenticated users
      if (user && bookId) {
        try {
          const response = await readerApi.getProgress(bookId);
          if (response.ok) {
            progress = await response.json();
            // Cache to localStorage
            localStorage.setItem(`reading-progress-${bookId}`, JSON.stringify(progress));
          }
        } catch (e) {
          console.error('Failed to load progress from API:', e);
        }
      }
      
      // Fallback to localStorage
      if (!progress) {
        try {
          const savedProgress = localStorage.getItem(`reading-progress-${bookId}`);
          if (savedProgress) {
            progress = JSON.parse(savedProgress);
          }
        } catch (e) {
          console.error('Failed to load progress from localStorage:', e);
        }
      }
      
      // Navigate to saved position
      if (progress && typeof progress.chapterIndex === 'number' && progress.chapterIndex >= 0) {
        // First go to chapter, then after pagination completes, go to specific page
        setTimeout(() => {
          readerRef.current?.goToChapter(progress.chapterIndex);
          
          // After chapter change and pagination, restore page position
          // currentPage is 1-based (from getCurrentPage), convert to 0-based for goToPosition
          if (typeof progress.currentPage === 'number' && progress.currentPage > 1) {
            setTimeout(() => {
              const position: Position = {
                charOffset: 0,
                chapterIndex: progress.chapterIndex,
                pageInChapter: progress.currentPage - 1, // Convert to 0-based
                totalPagesInChapter: progress.totalPages || 1,
                percentage: progress.percentage || 0,
              };
              readerRef.current?.goToPosition(position);
            }, 300);
          }
        }, 200);
      }
    };
    
    restoreProgress();
    
    // Hide global splash screen with animation
    // Use longer display time (1600ms) for direct page loads (refresh), shorter (800ms) for navigation
    const loadDuration = Date.now() - loadStartTimeRef.current;
    const minDisplayTime = isDirectLoadRef.current ? 1600 : 800;
    const remainingTime = Math.max(0, minDisplayTime - loadDuration);
    
    // Reset the direct load flag after using it
    isDirectLoadRef.current = false;
    
    // Wait for remaining time, then fade out
    setTimeout(() => {
      hideSplash();
    }, remainingTime);
  }, [bookId, user, hideSplash]);
  
  const handlePositionChange = useCallback((position: Position) => {
    setCurrentPosition(position);
    // Update page numbers from reader ref
    let currPage = 0;
    let totPages = 1;
    if (readerRef.current) {
      currPage = readerRef.current.getCurrentPage();
      totPages = readerRef.current.getTotalPages();
      setCurrentPage(currPage);
      setTotalPages(totPages);
      
      // Update overall page numbers (across all chapters)
      setCurrentPageOverall(readerRef.current.getEstimatedCurrentPageOverall());
      setTotalPagesOverall(readerRef.current.getEstimatedTotalPages());
    }
    
    // Save progress to localStorage immediately
    const progressData = {
      currentPage: currPage,
      totalPages: totPages,
      percentage: position.percentage,
      chapterIndex: position.chapterIndex,
    };
    localStorage.setItem(`reading-progress-${bookId}`, JSON.stringify(progressData));
    
    // Save to API for authenticated users with debouncing
    if (user && bookId) {
      // Clear any pending timeout
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
      }
      
      // Debounce: save after 2 seconds of no changes
      progressSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await readerApi.updateProgress(bookId, progressData);
          lastProgressSaveRef.current = Date.now();
        } catch (e) {
          console.error('Failed to sync progress to API:', e);
        }
      }, 2000);
    }
  }, [user, bookId]);
  
  const handleTextSelect = useCallback((selection: TextSelection | null) => {
    if (selection?.range) {
      // Use the range from the selection (captured synchronously in ReaderCore)
      selectionRangeRef.current = selection.range;
    } else {
      selectionRangeRef.current = null;
    }
    // Hide popover first, will show after selection is restored
    setShowSelectionPopover(false);
    setSelectedText(selection);
  }, []);
  
  // Close selection popover when clicking outside
  const selectionPopoverRef = useRef<HTMLDivElement>(null);
  
  // Restore selection and show popover after delay
  // Use useLayoutEffect to run synchronously after DOM update, before browser paint
  useLayoutEffect(() => {
    if (!selectedText || !selectionRangeRef.current) {
      setShowSelectionPopover(false);
      return;
    }
    
    const storedRange = selectionRangeRef.current;
    
    const restoreSelection = () => {
      try {
        const currentSelection = window.getSelection();
        if (!currentSelection) return;
        
        // Always restore to ensure selection is visible
        currentSelection.removeAllRanges();
        currentSelection.addRange(storedRange.cloneRange());
      } catch (e) {
        console.debug('Could not restore selection:', e);
      }
    };
    
    // Restore immediately (synchronously)
    restoreSelection();
    
    // Also restore after microtask
    queueMicrotask(restoreSelection);
    
    // Show popover after selection has stabilized
    const showTimer = setTimeout(() => {
      restoreSelection();
      setShowSelectionPopover(true);
    }, 100);
    
    return () => {
      clearTimeout(showTimer);
    };
  }, [selectedText]);
  
  useEffect(() => {
    if (!showSelectionPopover || !selectedText) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking on the popover itself
      if (selectionPopoverRef.current?.contains(e.target as Node)) {
        return;
      }
      // Clear selection and close popover
      window.getSelection()?.removeAllRanges();
      setShowSelectionPopover(false);
      setSelectedText(null);
    };
    
    // Add listener immediately since popover is already shown
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSelectionPopover, selectedText]);
  
  // Effect to find bookmark text and get its bounding rect
  useEffect(() => {
    if (!bookmarkHighlight) {
      setBookmarkHighlightRect(null);
      return;
    }
    
    // Wait a bit for the page to render after navigation
    const timer = setTimeout(() => {
      const textToFind = bookmarkHighlight.text;
      const contextToFind = bookmarkHighlight.context;
      if (!textToFind) return;
      
      // Find the text in the document
      const readerContent = document.querySelector('.reader-content');
      if (!readerContent) return;
      
      // Create a TreeWalker to find text nodes
      const walker = document.createTreeWalker(
        readerContent,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      // Collect all text nodes and build a map of positions
      const textNodes: { node: Node; start: number; end: number }[] = [];
      let totalOffset = 0;
      let node: Node | null;
      
      while ((node = walker.nextNode())) {
        const nodeText = node.textContent || '';
        textNodes.push({
          node,
          start: totalOffset,
          end: totalOffset + nodeText.length
        });
        totalOffset += nodeText.length;
      }
      
      // Get full text of the page
      const fullPageText = readerContent.textContent || '';
      
      // Find the context in the full text to locate the exact position
      let matchPosition = -1;
      if (contextToFind) {
        // Search for context (use a good portion of it for uniqueness)
        const searchContext = contextToFind.substring(0, 60);
        matchPosition = fullPageText.indexOf(searchContext);
        
        if (matchPosition !== -1) {
          // Find where the matched text appears within the context
          const matchInContext = contextToFind.indexOf(textToFind);
          if (matchInContext !== -1) {
            matchPosition += matchInContext;
          }
        }
      }
      
      // Fallback: just find the text directly
      if (matchPosition === -1) {
        matchPosition = fullPageText.indexOf(textToFind);
      }
      
      if (matchPosition === -1) return;
      
      // Find which text node contains this position
      for (const textNode of textNodes) {
        if (matchPosition >= textNode.start && matchPosition < textNode.end) {
          const localStart = matchPosition - textNode.start;
          const nodeText = textNode.node.textContent || '';
          const localEnd = Math.min(localStart + textToFind.length, nodeText.length);
          
          try {
            const range = document.createRange();
            range.setStart(textNode.node, localStart);
            range.setEnd(textNode.node, localEnd);
            const rect = range.getBoundingClientRect();
            
            if (rect.width > 0 && rect.height > 0) {
              setBookmarkHighlightRect(rect);
              return;
            }
          } catch (e) {
            console.debug('Could not create range for highlight:', e);
          }
          break;
        }
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [bookmarkHighlight]);
  
  const handleChapterChange = useCallback((chapter: Chapter) => {
    setCurrentChapter(chapter);
  }, []);
  
  const handleReaderError = useCallback((err: Error) => {
    // Hide splash screen immediately on reader error
    hideSplash();
    toastRef.current({
      title: "Ошибка чтения",
      description: err.message,
      variant: "destructive",
    });
  }, [hideSplash]);
  
  // Navigation
  const handleNext = useCallback(() => readerRef.current?.nextPage(), []);
  const handlePrev = useCallback(() => readerRef.current?.prevPage(), []);
  const handleGoToChapter = useCallback((index: number) => {
    readerRef.current?.goToChapter(index);
  }, []);
  
  // Bookmarks
  const handleAddBookmark = useCallback(async () => {
    const position = readerRef.current?.getPosition();
    if (!position) return;
    
    // Use selected text as title if available, otherwise use chapter title
    const title = selectedText?.text 
      ? (selectedText.text.length > 50 ? selectedText.text.substring(0, 50) + '...' : selectedText.text)
      : (currentChapter?.title || `Страница ${Math.round(position.percentage)}%`);
    
    const bookmarkData = {
      title,
      chapterIndex: position.chapterIndex,
      percentage: position.percentage,
      selectedText: selectedText?.text,
      pageInChapter: position.pageInChapter,
    };
    
    const authToken = localStorage.getItem('authToken');
    if (authToken && bookId) {
      // Authenticated: create via API
      try {
        const response = await readerApi.createBookmark(bookId, bookmarkData);
        if (response.ok) {
          const created = await response.json();
          const newBookmark: BookmarkItem = {
            ...created,
            createdAt: new Date(created.createdAt),
          };
          setBookmarks((prev) => [newBookmark, ...prev]);
          // Update localStorage cache
          const updatedBookmarks = [newBookmark, ...bookmarks];
          localStorage.setItem(`${BOOKMARKS_KEY}-${bookId}`, JSON.stringify(updatedBookmarks));
          toastRef.current({
            title: "Закладка добавлена",
            description: title,
          });
          return;
        }
      } catch (e) {
        console.error('Failed to create bookmark via API:', e);
      }
    }
    
    // Guest or API failed: create locally
    const newBookmark: BookmarkItem = {
      id: `local-${Date.now()}`,
      ...bookmarkData,
      createdAt: new Date(),
    };
    
    setBookmarks((prev) => {
      const updated = [newBookmark, ...prev];
      localStorage.setItem(`${BOOKMARKS_KEY}-${bookId}`, JSON.stringify(updated));
      return updated;
    });
    toastRef.current({
      title: "Закладка добавлена",
      description: title,
    });
  }, [currentChapter, selectedText, bookId, bookmarks]);
  
  const handleRemoveBookmark = useCallback(async (id: string) => {
    const authToken = localStorage.getItem('authToken');
    if (authToken && bookId && !id.startsWith('local-')) {
      // Authenticated with server bookmark: delete via API
      try {
        const response = await readerApi.deleteBookmark(id);
        if (response.ok) {
          setBookmarks((prev) => {
            const updated = prev.filter((b) => b.id !== id);
            localStorage.setItem(`${BOOKMARKS_KEY}-${bookId}`, JSON.stringify(updated));
            return updated;
          });
          return;
        }
      } catch (e) {
        console.error('Failed to delete bookmark via API:', e);
        toastRef.current({
          title: "Ошибка",
          description: "Не удалось удалить закладку",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Guest or local bookmark: delete locally
    setBookmarks((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      localStorage.setItem(`${BOOKMARKS_KEY}-${bookId}`, JSON.stringify(updated));
      return updated;
    });
  }, [bookId]);
  
  const handleRenameBookmark = useCallback(async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingBookmarkId(null);
      setEditBookmarkTitle('');
      return;
    }
    
    const authToken = localStorage.getItem('authToken');
    if (authToken && bookId && !id.startsWith('local-')) {
      // Authenticated with server bookmark: update via API
      try {
        const response = await readerApi.updateBookmark(id, newTitle.trim());
        if (response.ok) {
          setBookmarks((prev) => {
            const updated = prev.map((b) => 
              b.id === id ? { ...b, title: newTitle.trim() } : b
            );
            localStorage.setItem(`${BOOKMARKS_KEY}-${bookId}`, JSON.stringify(updated));
            return updated;
          });
          setEditingBookmarkId(null);
          setEditBookmarkTitle('');
          return;
        }
      } catch (e) {
        console.error('Failed to update bookmark via API:', e);
        toastRef.current({
          title: "Ошибка",
          description: "Не удалось переименовать закладку",
          variant: "destructive",
        });
        setEditingBookmarkId(null);
        setEditBookmarkTitle('');
        return;
      }
    }
    
    // Guest or local bookmark: update locally
    setBookmarks((prev) => {
      const updated = prev.map((b) => 
        b.id === id ? { ...b, title: newTitle.trim() } : b
      );
      localStorage.setItem(`${BOOKMARKS_KEY}-${bookId}`, JSON.stringify(updated));
      return updated;
    });
    setEditingBookmarkId(null);
    setEditBookmarkTitle('');
  }, [bookId]);
  
  const startEditingBookmark = useCallback((bookmark: BookmarkItem) => {
    setEditingBookmarkId(bookmark.id);
    setEditBookmarkTitle(bookmark.title);
  }, []);
  
  // Chat handlers
  const handleSendMessage = useCallback(async () => {
    if ((!chatInput.trim() && attachments.length === 0) || !bookId) return;
    
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      toastRef.current({
        title: "Ошибка",
        description: "Необходимо авторизоваться для отправки сообщений",
        variant: "destructive",
      });
      return;
    }
    
    // Check if message mentions a user (@username)
    const mentionMatch = chatInput.match(/@(\w+)/);
    let mentionedUserId: string | undefined;
    
    if (mentionMatch) {
      const mentionedUsername = mentionMatch[1];
      const mentionedUser = onlineUsers.find(u => u.username === mentionedUsername);
      if (mentionedUser) {
        mentionedUserId = mentionedUser.id;
      }
    }
    
    let attachmentUrls: string[] = [];
    let attachmentMetadata: any = null;
    
    // Upload attachments if any
    if (attachments.length > 0) {
      setUploadingFiles(true);
      try {
        const { fileUploadManager } = await import('@/lib/fileUploadManager');
        const uploadPromises = attachments.map(file => fileUploadManager.uploadFile(file));
        const uploads = await Promise.all(uploadPromises);
        
        attachmentUrls = uploads.map(u => u.url);
        attachmentMetadata = uploads.map(u => ({
          uploadId: u.uploadId,
          filename: u.filename,
          fileSize: u.fileSize,
          mimeType: u.mimeType,
          thumbnailUrl: u.thumbnailUrl,
        }));
      } catch (error) {
        console.error('Failed to upload attachments:', error);
        toastRef.current({
          title: "Ошибка",
          description: "Не удалось загрузить файлы",
          variant: "destructive",
        });
        setUploadingFiles(false);
        return;
      }
      setUploadingFiles(false);
    }
    
    // Send via WebSocket
    sendBookChatMessage(
      bookId, 
      chatInput, 
      mentionedUserId, 
      replyingTo?.id,
      attachmentUrls,
      attachmentMetadata
    );
    
    setChatInput('');
    setAttachments([]);
    setReplyingTo(null);
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    stopBookChatTyping(bookId);
  }, [chatInput, bookId, onlineUsers, attachments, replyingTo]);
  
  const handleChatInputChange = useCallback((value: string) => {
    setChatInput(value);
    
    if (!bookId) return;
    
    // Start typing indicator
    startBookChatTyping(bookId);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopBookChatTyping(bookId);
    }, 2000);
  }, [bookId]);
  
  const handleAddUserMention = useCallback((username: string) => {
    setChatInput(prev => `${prev}@${username} `.trim() + ' ');
    setChatTab('messages'); // Switch to messages tab
  }, []);
  
  const handleGoToBookmark = useCallback(async (bookmark: BookmarkItem) => {
    // If bookmark has selected text, use text search to find correct page
    // This works across different screen sizes (desktop/mobile)
    if (bookmark.selectedText) {
      await readerRef.current?.goToChapterAndFindText(
        bookmark.chapterIndex,
        bookmark.selectedText
      );
      
      // Show highlight with fade animation
      setBookmarkHighlight({
        text: bookmark.selectedText,
        chapterIndex: bookmark.chapterIndex,
        pageInChapter: bookmark.pageInChapter || 0,
        fading: false,
      });
      
      // Start fade after a short delay
      setTimeout(() => {
        setBookmarkHighlight(prev => prev ? { ...prev, fading: true } : null);
      }, 500);
      
      // Remove highlight after fade completes
      setTimeout(() => {
        setBookmarkHighlight(null);
      }, 1500);
    } else {
      // No selected text - navigate to chapter and specific page
      const position: Position = {
        charOffset: 0,
        chapterIndex: bookmark.chapterIndex,
        pageInChapter: bookmark.pageInChapter || 0,
        totalPagesInChapter: 1,
        percentage: bookmark.percentage,
      };
      readerRef.current?.goToPosition(position);
    }
    
    // Close bookmarks panel if setting is enabled OR on mobile (always close on mobile)
    const isMobile = window.innerWidth < 640;
    if (isMobile || settings.autoCloseBookmarksPanel !== false) {
      setActivePanel(null);
    }
  }, [settings.autoCloseBookmarksPanel]);
  
  // Search handlers
  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      const results = readerRef.current?.search(query) || [];
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, []);
  
  const handleSearchResultClick = useCallback(async (result: SearchResult) => {
    // Navigate to chapter using character offset for precise positioning
    // Use context (without ... markers) to find the exact location
    const cleanContext = result.context
      .replace(/^\.\.\./, '')
      .replace(/\.\.\.$/, '')
      .trim();
    
    await readerRef.current?.goToChapterAtOffset(
      result.chapterIndex,
      result.charOffset,
      cleanContext // Use the full context for more precise page finding
    );
    
    // Show highlight with fade animation (reusing bookmark highlight state)
    // Store both matchedText and context for precise highlighting
    setBookmarkHighlight({
      text: result.matchedText,
      context: cleanContext, // Store context to find the correct occurrence
      chapterIndex: result.chapterIndex,
      pageInChapter: 0,
      fading: false,
    });
    
    // Start fade after a short delay
    setTimeout(() => {
      setBookmarkHighlight(prev => prev ? { ...prev, fading: true } : null);
    }, 500);
    
    // Remove highlight after fade completes
    setTimeout(() => {
      setBookmarkHighlight(null);
    }, 1500);
    
    // Close search panel on mobile for better visibility
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      setActivePanel(null);
    }
    // On desktop, don't close panel - user can continue searching
  }, []);
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка книги...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Ошибка загрузки</h2>
          <p className="text-muted-foreground mb-4">{error || 'Не удалось загрузить книгу'}</p>
          <Link href="/library">
            <Button>Вернуться в библиотеку</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <ReaderToolbar
        book={{ id: book.id, title: book.title, author: book.author }}
        content={bookContent}
        currentChapter={currentChapter}
        position={currentPosition}
        currentPageInChapter={currentPage}
        totalPagesInChapter={totalPages}
        currentPageOverall={currentPageOverall}
        totalPagesOverall={totalPagesOverall}
        overallPercentage={currentPosition?.percentage || 0}
        settings={settings}
        onPrevPage={handlePrev}
        onNextPage={handleNext}
        onOpenToc={() => setActivePanel(activePanel === 'toc' ? null : 'toc')}
        onOpenSearch={() => setActivePanel(activePanel === 'search' ? null : 'search')}
        onOpenBookmarks={() => setActivePanel(activePanel === 'bookmarks' ? null : 'bookmarks')}
        onOpenSettings={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}
        onOpenAI={() => setActivePanel(activePanel === 'ai' ? null : 'ai')}
        onOpenChat={() => { setActivePanel(activePanel === 'chat' ? null : 'chat'); if (activePanel !== 'chat') setUnreadChatCount(0); }}
        isTocOpen={activePanel === 'toc'}
        isSearchOpen={activePanel === 'search'}
        isBookmarksOpen={activePanel === 'bookmarks'}
        isSettingsOpen={activePanel === 'settings'}
        isAIOpen={activePanel === 'ai'}
        isChatOpen={activePanel === 'chat'}
        unreadChatCount={unreadChatCount}
      />
      
      {/* Main content - full height */}
      <div className="flex-1 relative overflow-x-hidden overflow-y-hidden">
        {/* External navigation zones - Outside mode */}
        {settings.viewMode === 'paginated' && settings.navigationZonePosition === 'outside' && (
          <>
            {/* Left navigation zone - from screen edge to book container */}
            <div
              className="absolute left-0 top-0 bottom-0 z-5 cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
              style={{
                width: 'calc((100vw - 72rem) / 2)',
                minWidth: '40px',
                background: `linear-gradient(to right, ${THEME_COLORS[settings.theme].accent}40, transparent)`,
              }}
              onClick={() => handlePrev()}
              title="Предыдущая страница"
            >
              <svg 
                className="w-8 h-8 opacity-60" 
                style={{ color: THEME_COLORS[settings.theme].text }}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            
            {/* Right navigation zone - from book container to screen edge, hidden when panel is open */}
            {!activePanel && (
              <div
                className="absolute right-0 top-0 bottom-0 z-5 cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
                style={{
                  width: 'calc((100vw - 72rem) / 2)',
                  minWidth: '40px',
                  background: `linear-gradient(to left, ${THEME_COLORS[settings.theme].accent}40, transparent)`,
                }}
                onClick={() => handleNext()}
                title="Следующая страница"
              >
                <svg 
                  className="w-8 h-8 opacity-60" 
                  style={{ color: THEME_COLORS[settings.theme].text }}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </>
        )}

        <div className="max-w-6xl mx-auto px-4 py-4 h-full">
          {/* Reader area - fixed size, not affected by panels */}
          <div 
            className="h-full"
            onClick={() => {
              // Close ToC and Search panels when clicking on book content
              if (activePanel === 'toc' || activePanel === 'search') {
                setActivePanel(null);
              }
            }}
          >
            <div className="bg-card border rounded-lg shadow-sm h-full">
              {bookUrl && (
                <ReaderCore
                  ref={readerRef}
                  bookUrl={bookUrl}
                  fileType={book.fileType || ''}
                  initialPosition={positionParam}
                  settings={settings}
                  onReady={handleReaderReady}
                  onPositionChange={handlePositionChange}
                  onTextSelect={handleTextSelect}
                  onChapterChange={handleChapterChange}
                  onError={handleReaderError}
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Unified side panel - single container for all menus with slide animation */}
        <div 
          className={`absolute right-0 top-0 bottom-0 w-[400px] max-w-[90vw] border-l bg-background shadow-lg z-10 transition-transform duration-300 ease-in-out overflow-hidden ${
            activePanel ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          }`}
        >
          {activePanel && (
            <div className="h-full flex flex-col">
              {/* Panel header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  {activePanel === 'toc' && <List className="w-5 h-5" />}
                  {activePanel === 'search' && <Search className="w-5 h-5" />}
                  {activePanel === 'bookmarks' && <Bookmark className="w-5 h-5" />}
                  {activePanel === 'settings' && <Settings className="w-5 h-5" />}
                  {activePanel === 'ai' && <Brain className="w-5 h-5" />}
                  {activePanel === 'chat' && <MessageCircle className="w-5 h-5" />}
                  <h3 className="font-semibold">
                    {activePanel === 'toc' && t('reader.panelToc')}
                    {activePanel === 'search' && t('reader.panelSearch')}
                    {activePanel === 'bookmarks' && t('reader.panelBookmarks')}
                    {activePanel === 'settings' && t('reader.panelSettings')}
                    {activePanel === 'ai' && t('reader.panelAI')}
                    {activePanel === 'chat' && t('reader.panelChat')}
                  </h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setActivePanel(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Panel content */}
              <ScrollArea className="flex-1">
                {/* Table of Contents Panel */}
                {activePanel === 'toc' && (
                  <div className="p-4">
                    {bookContent?.chapters.map((chapter, index) => (
                      <button
                        key={index}
                        className={`w-full text-left px-3 py-2 hover:bg-muted rounded-md text-sm ${
                          currentChapter?.index === index ? 'bg-primary/10 text-primary font-medium' : ''
                        }`}
                        onClick={() => handleGoToChapter(index)}
                      >
                        {chapter.title}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Search Panel */}
                {activePanel === 'search' && (
                  <div className="p-4 space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t('search.placeholder')}
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        className="pl-9"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground mb-2">
                          Найдено: {searchResults.length} {searchResults.length === 1 ? 'результат' : searchResults.length < 5 ? 'результата' : 'результатов'}
                        </p>
                        {searchResults.map((result, index) => {
                          // Highlight search query in context
                          const highlightText = (text: string, query: string) => {
                            if (!query.trim()) return text;
                            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                            const parts = text.split(regex);
                            return parts.map((part, i) => 
                              regex.test(part) ? (
                                <mark key={i} className="bg-amber-200 dark:bg-amber-800 text-inherit rounded-sm px-0.5">
                                  {part}
                                </mark>
                              ) : part
                            );
                          };
                          
                          return (
                            <button
                              key={index}
                              className="w-full text-left p-2 hover:bg-muted rounded-md text-sm"
                              onClick={() => handleSearchResultClick(result)}
                            >
                              <p className="text-xs text-muted-foreground mb-1">
                                Глава {result.chapterIndex + 1}
                              </p>
                              <p className="line-clamp-2">{highlightText(result.context, searchQuery)}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    
                    {searchQuery.length >= 2 && searchResults.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Ничего не найдено
                      </p>
                    )}
                  </div>
                )}
                
                {/* Bookmarks Panel */}
                {activePanel === 'bookmarks' && (
                  <div className="p-4">
                    <Button
                      variant="outline"
                      className="w-full mb-4"
                      onClick={handleAddBookmark}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('bookmarks.addBookmark')}
                    </Button>
                    
                    {bookmarks.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Нет закладок</p>
                        <p className="text-sm">Добавьте закладку, чтобы вернуться к этому месту позже</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {bookmarks.map((bookmark) => (
                          <div
                            key={bookmark.id}
                            className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted group"
                          >
                            {editingBookmarkId === bookmark.id ? (
                              // Inline editing mode
                              <div className="flex-1 flex items-center gap-2">
                                <Input
                                  value={editBookmarkTitle}
                                  onChange={(e) => setEditBookmarkTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameBookmark(bookmark.id, editBookmarkTitle);
                                    } else if (e.key === 'Escape') {
                                      setEditingBookmarkId(null);
                                      setEditBookmarkTitle('');
                                    }
                                  }}
                                  autoFocus
                                  className="h-8 text-sm"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => handleRenameBookmark(bookmark.id, editBookmarkTitle)}
                                >
                                  <span className="text-xs">OK</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => {
                                    setEditingBookmarkId(null);
                                    setEditBookmarkTitle('');
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              // Normal display mode
                              <>
                                <button
                                  className="flex-1 text-left"
                                  onClick={() => handleGoToBookmark(bookmark)}
                                >
                                  <p className="font-medium text-sm line-clamp-1">{bookmark.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {Math.round(bookmark.percentage)}% • {bookmark.createdAt.toLocaleDateString()}
                                  </p>
                                </button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                  onClick={() => startEditingBookmark(bookmark)}
                                >
                                  <Pencil className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                  onClick={() => handleRemoveBookmark(bookmark.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Settings Panel */}
                {activePanel === 'settings' && (
                  <div className="p-4 space-y-6">
                    {/* Font Family */}
                    <div className="space-y-2">
                      <Label>{t('settings.font')}</Label>
                      <Select
                        value={settings.fontFamily}
                        onValueChange={(value) => updateSettings({ fontFamily: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Georgia, serif">Georgia</SelectItem>
                          <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
                          <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                          <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                          <SelectItem value="'Courier New', monospace">Courier New</SelectItem>
                          <SelectItem value="'PT Serif', serif">PT Serif</SelectItem>
                          <SelectItem value="'Open Sans', sans-serif">Open Sans</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Font Size */}
                    <div className="space-y-2">
                      <Label>{t('settings.fontSize')}: {settings.fontSize}px</Label>
                      <Slider
                        value={[settings.fontSize]}
                        onValueChange={([value]) => updateSettings({ fontSize: value })}
                        min={12}
                        max={32}
                        step={1}
                      />
                    </div>
                    
                    {/* Line Height */}
                    <div className="space-y-2">
                      <Label>Межстрочный интервал: {settings.lineHeight}</Label>
                      <Slider
                        value={[settings.lineHeight]}
                        onValueChange={([value]) => updateSettings({ lineHeight: value })}
                        min={1}
                        max={2.5}
                        step={0.1}
                      />
                    </div>
                    
                    {/* Theme */}
                    <div className="space-y-2">
                      <Label>{t('settings.theme')}</Label>
                      <Select
                        value={settings.theme}
                        onValueChange={(value: 'light' | 'dark' | 'sepia') => updateSettings({ theme: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
                          <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
                          <SelectItem value="sepia">{t('settings.themeSepia')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Text Align */}
                    <div className="space-y-2">
                      <Label>{t('settings.textAlign')}</Label>
                      <Select
                        value={settings.textAlign}
                        onValueChange={(value: 'left' | 'justify' | 'center') => updateSettings({ textAlign: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">{t('settings.textAlignLeft')}</SelectItem>
                          <SelectItem value="justify">{t('settings.textAlignJustify')}</SelectItem>
                          <SelectItem value="center">{t('settings.textAlignCenter')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Margins */}
                    <div className="space-y-2">
                      <Label>{t('settings.margins')}: {settings.margins}px</Label>
                      <Slider
                        value={[settings.margins]}
                        onValueChange={([value]) => updateSettings({ margins: value })}
                        min={10}
                        max={60}
                        step={5}
                      />
                    </div>
                    
                    {/* Show Progress Bar */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showProgressBar"
                        checked={settings.showProgressBar !== false}
                        onCheckedChange={(checked) => updateSettings({ showProgressBar: checked === true })}
                      />
                      <Label htmlFor="showProgressBar" className="cursor-pointer">
                        {t('settings.showProgressBar')}
                      </Label>
                    </div>
                    
                    {/* Auto-close Bookmarks Panel */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="autoCloseBookmarksPanel"
                        checked={settings.autoCloseBookmarksPanel !== false}
                        onCheckedChange={(checked) => updateSettings({ autoCloseBookmarksPanel: checked === true })}
                      />
                      <Label htmlFor="autoCloseBookmarksPanel" className="cursor-pointer">
                        {t('settings.autoCloseBookmarksPanel')}
                      </Label>
                    </div>
                    
                    {/* Navigation Zone Position */}
                    <div className="space-y-2">
                      <Label>{t('settings.navigationZones')}</Label>
                      <Select
                        value={settings.navigationZonePosition || 'inside'}
                        onValueChange={(value: 'inside' | 'outside') => updateSettings({ navigationZonePosition: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inside">{t('settings.navigationInside')}</SelectItem>
                          <SelectItem value="outside">{t('settings.navigationOutside')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                
                {/* AI Panel */}
                {activePanel === 'ai' && (
                  <div className="p-4 space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30">
                      <p className="text-sm font-medium text-center mb-2">
                        {t('ai.comingSoon')}
                      </p>
                      <p className="text-xs text-muted-foreground text-center">
                        {t('ai.comingSoonDescription')}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Chat Panel */}
                {activePanel === 'chat' && (
                  <div className="flex flex-col h-full">
                    <Tabs value={chatTab} onValueChange={(v) => setChatTab(v as 'messages' | 'users')} className="flex-1 flex flex-col">
                      <TabsList className="grid w-full grid-cols-2 px-4 mb-0 py-1 mt-2 rounded-none bg-background">
                        <TabsTrigger value="messages">{t('bookChat.tabMessages')}</TabsTrigger>
                        <TabsTrigger value="users">{t('bookChat.tabOnline')} ({onlineUsers.length})</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="messages" className="flex-1 flex flex-col mt-0">
                        {/* Message input at top */}
                        <div className="p-4 pb-2">
                          {replyingTo && (
                            <div className="mb-2 p-2 bg-muted/50 rounded-lg flex items-start gap-2">
                              <Reply className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">
                                  Ответ на {replyingTo.user?.username}:
                                </p>
                                <p className="text-sm truncate">{replyingTo.content}</p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setReplyingTo(null)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Input
                              value={chatInput}
                              onChange={(e) => handleChatInputChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                              placeholder={t('bookChat.writeMessage')}
                              className="flex-1"
                              disabled={uploadingFiles}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => document.getElementById('chat-file-input')?.click()}
                              disabled={uploadingFiles}
                            >
                              <Paperclip className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              onClick={handleSendMessage}
                              disabled={(!chatInput.trim() && attachments.length === 0) || uploadingFiles}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {attachments.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                                  <Paperclip className="w-3 h-3" />
                                  <span className="max-w-[100px] truncate">{file.name}</span>
                                  <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <input
                            id="chat-file-input"
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.doc,.docx,text/plain"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length > 0) {
                                setAttachments(prev => [...prev, ...files.slice(0, 5 - prev.length)]);
                              }
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </div>
                        
                        {/* Typing indicator */}
                        {typingUsers.size > 0 && (
                          <div className="px-4 py-1 text-xs text-muted-foreground border-b">
                            {Array.from(typingUsers).slice(0, 3).map((userId, idx, arr) => {
                              const typingUser = onlineUsers.find(u => u.id === userId);
                              return typingUser ? (
                                <span key={userId}>
                                  {typingUser.username}
                                  {idx < arr.length - 1 ? ', ' : ''}
                                </span>
                              ) : null;
                            })}
                            {' печатает...'}
                          </div>
                        )}
                        
                        {/* Messages list - newest on top */}
                        <div className="flex-1 overflow-y-auto px-4">
                          {chatMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-8">
                              <MessageCircle className="w-12 h-12 text-muted-foreground/50 mb-4" />
                              <p className="text-sm text-muted-foreground">
                                Пока нет сообщений
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Будьте первым, кто начнёт обсуждение!
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3 py-4">
                              {[...chatMessages].reverse().map((msg) => {
                                const isCurrentUser = user?.id === msg.userId;
                                const isMentioned = user?.id === msg.mentionedUserId;
                                
                                return (
                                  <div
                                    key={msg.id}
                                    className={`p-3 rounded-lg ${
                                      isMentioned
                                        ? 'bg-orange-500/10 border border-orange-500/30'
                                        : isCurrentUser
                                        ? 'bg-primary/10'
                                        : 'bg-muted/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      {msg.user?.avatarUrl ? (
                                        <img
                                          src={msg.user.avatarUrl}
                                          alt={msg.user.username}
                                          className="w-6 h-6 rounded-full"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                          <span className="text-xs font-semibold">
                                            {msg.user?.username?.[0]?.toUpperCase() || '?'}
                                          </span>
                                        </div>
                                      )}
                                      <button
                                        onClick={() => {
                                          setChatInput(prev => `${prev}@${msg.user?.username} `.trim() + ' ');
                                        }}
                                        className="text-sm font-semibold hover:underline"
                                      >
                                        {msg.user?.username || 'Unknown'}
                                      </button>
                                      <a
                                        href={`/profile/${msg.userId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Открыть профиль"
                                      >
                                        <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
                                      </a>
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 ml-1"
                                        onClick={() => setReplyingTo(msg)}
                                        title="Ответить"
                                      >
                                        <Reply className="w-3 h-3" />
                                      </Button>
                                      {(isCurrentUser || user?.accessLevel === 'admin' || user?.accessLevel === 'moder') && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 ml-1 hover:bg-destructive/10 hover:text-destructive"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('[DELETE] Attempting to delete message:', msg.id, 'in book:', bookId);
                                            deleteBookChatMessage(bookId, msg.id);
                                          }}
                                          title="Удалить"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {msg.quotedMessage && (
                                      <div className="mb-2 ml-8 p-2 bg-background/50 rounded border-l-2 border-primary/30">
                                        <p className="text-xs text-muted-foreground mb-1">
                                          Ответ на {msg.quotedMessage.user?.username}:
                                        </p>
                                        <p className="text-xs line-clamp-2">
                                          {msg.quotedMessage.content}
                                        </p>
                                      </div>
                                    )}
                                    
                                    <p className="text-sm whitespace-pre-wrap break-words ml-8">
                                      {msg.content}
                                    </p>
                                    
                                    {msg.attachmentUrls && Array.isArray(msg.attachmentUrls) && msg.attachmentUrls.length > 0 && (
                                      <div className="mt-2 ml-8 space-y-1">
                                        {msg.attachmentUrls.map((url: string, idx: number) => {
                                          const metadata = Array.isArray(msg.attachmentMetadata) ? msg.attachmentMetadata[idx] : null;
                                          const isImage = metadata?.mimeType?.startsWith('image/');
                                          
                                          return (
                                            <div key={idx}>
                                              {isImage ? (
                                                <img
                                                  src={url}
                                                  alt={metadata?.filename || 'Изображение'}
                                                  className="max-w-full max-h-48 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                                  onClick={() => {
                                                    // Get all image URLs from this message
                                                    const imageUrls = msg.attachmentUrls.filter((_: string, i: number) => {
                                                      const meta = Array.isArray(msg.attachmentMetadata) ? msg.attachmentMetadata[i] : null;
                                                      return meta?.mimeType?.startsWith('image/');
                                                    });
                                                    setCurrentMessageImages(imageUrls);
                                                    setCurrentImageIndex(imageUrls.indexOf(url));
                                                    setImageViewerOpen(true);
                                                  }}
                                                />
                                              ) : (
                                                <a
                                                  href={url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-2 text-xs text-primary hover:underline"
                                                >
                                                  <Paperclip className="w-3 h-3" />
                                                  {metadata?.filename || 'Файл'}
                                                </a>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    
                                    {isMentioned && (
                                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 ml-8">
                                        {t('bookChat.addressedToYou')}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="users" className="flex-1 mt-0">
                        <div className="h-full overflow-y-auto px-4">
                          {onlineUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-8">
                              <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
                              <p className="text-sm text-muted-foreground">
                                Нет пользователей онлайн
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 py-4">
                              {onlineUsers.map((onlineUser) => (
                                <div
                                  key={onlineUser.id}
                                  className="w-full p-3 rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-3"
                                >
                                  {onlineUser.avatarUrl ? (
                                    <img
                                      src={onlineUser.avatarUrl}
                                      alt={onlineUser.username}
                                      className="w-10 h-10 rounded-full"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                      <span className="text-lg font-semibold">
                                        {onlineUser.username[0].toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <button
                                      onClick={() => {
                                        setChatInput(prev => `${prev}@${onlineUser.username} `.trim() + ' ');
                                        setChatTab('messages');
                                      }}
                                      className="font-medium hover:underline text-left"
                                    >
                                      {onlineUser.username}
                                    </button>
                                    <p className="text-xs text-muted-foreground">{t('bookChat.readingBook')}</p>
                                  </div>
                                  <a
                                    href={`/profile/${onlineUser.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Открыть профиль"
                                  >
                                    <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                  </a>
                                  <div className="w-2 h-2 rounded-full bg-green-500" title="Онлайн" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
      
      {/* Custom highlight overlay - shows selected text area independent of browser selection */}
      {selectedText && selectedText.rect && (
        <div
          className="fixed pointer-events-none z-40"
          style={{
            top: selectedText.rect.top,
            left: selectedText.rect.left,
            width: selectedText.rect.width,
            height: selectedText.rect.height,
            backgroundColor: 'rgba(59, 130, 246, 0.3)',
            borderRadius: '2px',
          }}
        />
      )}
      
      {/* Bookmark highlight overlay - orange color with fade animation */}
      {bookmarkHighlight && bookmarkHighlightRect && (
        <div
          className="fixed pointer-events-none z-40"
          style={{
            top: bookmarkHighlightRect.top,
            left: bookmarkHighlightRect.left,
            width: bookmarkHighlightRect.width,
            height: bookmarkHighlightRect.height,
            backgroundColor: 'rgba(249, 115, 22, 0.5)', // Orange like logo
            borderRadius: '2px',
            opacity: bookmarkHighlight.fading ? 0 : 1,
            transition: 'opacity 1s ease-out',
          }}
        />
      )}
      
      {/* Text selection popover - only show after delay to preserve selection */}
      {showSelectionPopover && selectedText && selectedText.rect && (
        <div
          ref={selectionPopoverRef}
          className="fixed z-50 bg-popover border rounded-lg shadow-lg p-2"
          style={{
            top: Math.min(selectedText.rect.bottom + 8, window.innerHeight - 60),
            left: Math.max(8, Math.min(selectedText.rect.left, window.innerWidth - 200)),
          }}
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onFocus={(e) => {
            e.preventDefault();
            // Restore selection if focus event cleared it
            if (selectionRangeRef.current) {
              const sel = window.getSelection();
              if (sel && sel.isCollapsed) {
                sel.removeAllRanges();
                sel.addRange(selectionRangeRef.current.cloneRange());
              }
            }
          }}
        >
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                handleAddBookmark();
                window.getSelection()?.removeAllRanges();
                setShowSelectionPopover(false);
                setSelectedText(null);
              }}
            >
              <Bookmark className="w-4 h-4 mr-1" />
              Закладка
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                navigator.clipboard.writeText(selectedText.text);
                toastRef.current({ title: "Скопировано" });
                window.getSelection()?.removeAllRanges();
                setShowSelectionPopover(false);
                setSelectedText(null);
              }}
            >
              Копировать
            </Button>
          </div>
        </div>
      )}
      
      {/* Image Viewer Popup */}
      {imageViewerOpen && currentMessageImages.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setImageViewerOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setImageViewerOpen(false)}
          >
            <X className="w-8 h-8" />
          </button>
          
          {currentMessageImages.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(prev => Math.max(0, prev - 1));
                }}
                disabled={currentImageIndex === 0}
              >
                <ChevronLeft className="w-12 h-12" />
              </button>
              
              <button
                className="absolute right-4 text-white hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(prev => Math.min(currentMessageImages.length - 1, prev + 1));
                }}
                disabled={currentImageIndex === currentMessageImages.length - 1}
              >
                <ChevronRight className="w-12 h-12" />
              </button>
            </>
          )}
          
          <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            <img
              src={currentMessageImages[currentImageIndex]}
              alt={`Изображение ${currentImageIndex + 1} из ${currentMessageImages.length}`}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {currentMessageImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded">
              {currentImageIndex + 1} / {currentMessageImages.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
