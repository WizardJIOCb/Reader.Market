import React, { useState, useEffect, Suspense, useCallback, useMemo, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmojiPicker } from '@/components/EmojiPicker';
import { ReactionBar } from '@/components/ReactionBar';
import { AuthPrompt } from '@/components/AuthPrompt';
import { 
  Search, 
  Calendar, 
  Eye, 
  Plus,
  Filter,
  Bookmark,
  Menu,
  Heart,
  ThumbsUp,
  MessageCircle,
  Reply,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Smile,
  Send,
  Quote,
  ChevronUp
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

// Helper function to calculate total reply count recursively
const getTotalReplyCount = (reply: Comment): number => {
  if (!reply.replies || reply.replies.length === 0) {
    return 0;
  }
  
  let count = reply.replies.length;
  for (const nestedReply of reply.replies) {
    count += getTotalReplyCount(nestedReply);
  }
  return count;
};

// Helper function to calculate total reply count for a comment including all nested replies
const getTotalCommentReplyCount = (comment: Comment): number => {
  return getTotalReplyCount(comment);
};

// Recursive component for nested replies
const RecursiveReplyItem: React.FC<{ 
  reply: Comment;
  user: any;
  startReply: (comment: Comment) => void;
  replyingTo: Comment | null;
  replyInput: string;
  setReplyInput: React.Dispatch<React.SetStateAction<string>>;
  submitReply: (parentCommentId: string) => Promise<void>;
  cancelReply: () => void;
  toggleCommentReaction: (commentId: string, emoji: string) => Promise<void>;
  expandedReplies: Set<string>;
  toggleReplyExpansion: (replyId: string) => void;
  depth?: number; // Added depth parameter to distinguish nesting level
  t: any;
  i18n: any;
  ru: any;
  enUS: any;
}> = ({
  reply,
  user,
  startReply,
  replyingTo,
  replyInput,
  setReplyInput,
  submitReply,
  cancelReply,
  toggleCommentReaction,
  expandedReplies,
  toggleReplyExpansion,
  depth = 0, // Default depth is 0
  t,
  i18n,
  ru,
  enUS,
}) => {
  const hasNestedReplies = reply.replies && reply.replies.length > 0;
  const totalReplyCount = getTotalReplyCount(reply);
  
  // Determine if this reply should have the left border based on depth
  const shouldShowBorder = depth > 0;
  
  return (
    <div className={shouldShowBorder ? "ml-4 border-l-2 border-muted-foreground/20 pl-3" : ""}>
      <div key={reply.id} className={`rounded-lg ${(depth > 0) ? (user && reply.userId === user.id ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : '') : `border ${(user && reply.userId === user.id) ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : 'bg-card'}`} ${(depth > 0) ? 'p-2.5' : 'p-4'}`}>
        <div className={`flex items-start justify-between ${depth > 0 ? 'gap-2' : 'gap-3'} mb-1`}>
          <div className="flex items-center gap-2 flex-1">
            <Avatar className={`flex-shrink-0 ${depth > 0 ? 'w-7 h-7' : 'w-10 h-10'}`}>
              {reply.userAvatar ? (
                <AvatarImage src={reply.userAvatar} alt={reply.author || reply.username} />
              ) : null}
              <AvatarFallback className="text-xs">
                {(reply.author || reply.username)?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className={`text-xs font-medium ${user && reply.userId === user.id ? 'text-[#2a2520] dark:text-[#fbf6f0]' : ''}`}>
                <Link 
                  href={`/profile/${reply.userId}`}
                  className="hover:underline"
                >
                  {reply.author || reply.username}
                </Link>
                {user && reply.userId === user.id && (
                  <span className="ml-1 text-xs text-[#5a5550] dark:text-[#cbc6c0]">(me)</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help">
                        {format(new Date(reply.createdAt), 'MMM d, yyyy', { locale: i18n.language === 'ru' ? ru : enUS })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(new Date(reply.createdAt), 'dd.MM.yyyy HH:mm', { locale: i18n.language === 'ru' ? ru : enUS })}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(reply.parentCommentAuthor && reply.parentCommentId) && (
                  <span className="text-xs text-muted-foreground">
                    · replying to {reply.parentCommentAuthor}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">
                    {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: i18n.language === 'ru' ? ru : enUS })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{format(new Date(reply.createdAt), 'dd.MM.yyyy HH:mm', { locale: i18n.language === 'ru' ? ru : enUS })}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        <p className="text-xs mb-2 whitespace-pre-wrap">{reply.content}</p>
        
        {/* Actions row for reply - with expand/collapse button for nested replies */}
        <div className="flex items-center gap-2 flex-wrap">
          {user && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => startReply(reply)}
            >
              <Reply className="w-2.5 h-2.5 mr-1" />
              {t('articles:reply')}
            </Button>
          )}
          
          {/* Show expand/collapse button for nested replies if they exist */}
          {hasNestedReplies && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => toggleReplyExpansion(reply.id)}
            >
              {expandedReplies.has(reply.id) ? (
                <>
                  <ChevronUp className="w-2.5 h-2.5 mr-1" />
                  {t('articles:hideReplies')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-2.5 h-2.5 mr-1" />
                  {t('profile:ratings.repliesCount', { count: totalReplyCount })}
                </>
              )}
            </Button>
          )}
          
          <ReactionBar
            reactions={reply.reactions || []}
            onReact={(emoji: string) => toggleCommentReaction(reply.id, emoji)}
            commentId={reply.id}
          />
        </div>
        
        {/* Inline reply input for this specific reply */}
        {replyingTo?.id === reply.id && (
          <div className="mt-2 space-y-1.5 pt-2 border-t border-border/50">
            <div className="text-xs text-muted-foreground italic border-l-2 border-primary/50 pl-2 py-0.5">
              <Quote className="w-2.5 h-2.5 inline mr-1" />
              {replyingTo.content}
            </div>
            <div className="relative">
              <textarea
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder={`${t('articles:writeReply')}...`}
                rows={2}
                className="w-full px-3 py-2 text-xs min-h-[50px] bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitReply(reply.id);
                  }
                }}
                autoFocus
              />
              <div className="absolute bottom-1 right-1">
                <EmojiPicker
                  onEmojiSelect={(emoji) => setReplyInput(prev => prev + emoji)}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-xs text-muted-foreground mr-auto">Shift+Enter for new line</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs px-2"
                onClick={cancelReply}
              >
                {t('common:cancel')}
              </Button>
              <Button
                size="sm"
                className="h-5 text-xs px-3"
                onClick={() => submitReply(reply.id)}
                disabled={!replyInput.trim()}
              >
                {t('articles:reply')}
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Render nested replies conditionally based on expansion state */}
      {hasNestedReplies && expandedReplies.has(reply.id) && (
        <div className="mt-1.5 space-y-1.5">
          {reply.replies?.map((nestedReply) => (
            <RecursiveReplyItem
              key={nestedReply.id}
              reply={nestedReply}
              user={user}
              startReply={startReply}
              replyingTo={replyingTo}
              replyInput={replyInput}
              setReplyInput={setReplyInput}
              submitReply={submitReply}
              cancelReply={cancelReply}
              toggleCommentReaction={toggleCommentReaction}
              expandedReplies={expandedReplies}
              toggleReplyExpansion={toggleReplyExpansion}
              depth={depth + 1} // Increase depth for nested replies - depth 0 is main comment, depth 1 is first-level reply (no border), depth 2+ has borders
              t={t}
              i18n={i18n}
              ru={ru}
              enUS={enUS}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Memoized sidebar component
interface Comment {
  id: string;
  articleId: string;
  userId: string;
  author: string;
  username?: string;
  content: string;
  createdAt: string;
  reactions: Reaction[];
  userLiked: boolean; // Keep for compatibility with existing logic
  likes: number; // Keep for compatibility with existing logic
  userAvatar?: string | null;
  attachments?: any[];
  isOwnComment?: boolean;
  parentCommentId?: string | null;
  quotedText?: string | null;
  parentCommentAuthor?: string | null;
  replyCount?: number;
  replies?: Comment[];
  metadata?: {
    readingProgress?: {
      percentage: number;
      currentPage: number;
      totalPages: number;
    };
  };
}

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface ArticleReaction {
  articleId: string;
  likes: number;
  userLiked: boolean;
  reactions?: Reaction[];
}

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  t: any;
  categories: ArticleCategory[];
  expandedCategories: Set<string>;
  toggleCategory: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  showTreeView: boolean;
  setShowTreeView: (show: boolean) => void;
  showOnlyWithNew: boolean;
  setShowOnlyWithNew: (show: boolean) => void;
  filteredCategories: ArticleCategory[];
  user: any;
  navigate: (path: string) => void;
}

const SidebarComponent = React.memo(({ 
  sidebarOpen, 
  setSidebarOpen, 
  t, 
  categories, 
  expandedCategories, 
  toggleCategory, 
  searchQuery, 
  setSearchQuery, 
  selectedCategory, 
  setSelectedCategory, 
  showTreeView, 
  setShowTreeView, 
  showOnlyWithNew, 
  setShowOnlyWithNew,
  filteredCategories,
  user,
  navigate
}: SidebarProps) => {
  // Define CategoryTree and CategoryList components inside SidebarComponent
  const CategoryTree: React.FC<{
    categories: ArticleCategory[];
    expandedCategories: Set<string>;
    toggleCategory: (id: string) => void;
    onCategorySelect: (category: string | null) => void;
    selectedCategory: string | null;
    showOnlyWithNew: boolean;
  }> = ({
    categories,
    expandedCategories,
    toggleCategory,
    onCategorySelect,
    selectedCategory,
    showOnlyWithNew
  }) => {
    const renderCategory = (category: ArticleCategory) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.id);
      const isSelected = selectedCategory === category.slug;
      
      // Calculate article count including children if needed
      const articleCount = category.articleCount || 0;
      
      return (
        <div key={category.id} className="space-y-1">
          <div 
            className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-amber-100 ${isSelected ? 'bg-amber-200 font-medium' : ''}`}
            onClick={(e) => {
              // If clicking on the expand/collapse button, just toggle expansion
              if ((e.target as HTMLElement).closest('button')) {
                toggleCategory(category.id);
                return;
              }
              
              // Only expand the category if it's currently collapsed
              if (!isExpanded) {
                toggleCategory(category.id);
              }
              
              // Select the category to show articles
              onCategorySelect(category.slug);
            }}
          >
            <div className="flex items-center min-w-0 flex-1">
              <span className="font-medium truncate flex items-center gap-2">
                {hasChildren && category.slug !== 'favorites' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory(category.id);
                    }}
                    className="p-0.5 rounded-sm hover:bg-amber-200 mr-1"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                )}
                {category.slug === 'favorites' && (
                  <Heart 
                    className="h-4 w-4 text-red-500 fill-current" 
                    style={{marginRight: '8px'}}
                    strokeWidth={1}
                  />
                )}
                {category.title}
              </span>
            </div>
            <div className="flex items-center ml-2">
              <span className="text-xs bg-[#b2dd8b] px-2 py-1 rounded">
                {articleCount}
              </span>
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div className="ml-4 border-l border-[#ffd230] pl-2 space-y-1">
              {category.children!.map((childCategory) => {
                const childHasChildren = childCategory.children && childCategory.children.length > 0;
                const childIsExpanded = expandedCategories.has(childCategory.id);
                const childIsSelected = selectedCategory === childCategory.slug;
                
                return (
                  <div key={childCategory.id} className="space-y-1">
                    <div 
                      className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-amber-100 text-sm ${childIsSelected ? 'bg-amber-200 font-medium' : ''}`}
                      onClick={(e) => {
                        // If clicking on the expand/collapse button, just toggle expansion
                        if ((e.target as HTMLElement).closest('button')) {
                          toggleCategory(childCategory.id);
                          return;
                        }
                        
                        // Only expand the category if it's currently collapsed
                        if (!childIsExpanded) {
                          toggleCategory(childCategory.id);
                        }
                        
                        // Select the category to show articles
                        onCategorySelect(childCategory.slug);
                      }}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                          <span className="font-medium truncate" style={{fontSize: 'var(--text-sm)', lineHeight: 'var(--tw-leading, var(--text-sm--line-height))'}}>{childCategory.title}</span>
                        </span>
                      </div>
                      <div className="flex items-center ml-2">
                        <span className="text-xs bg-[#b2dd8b] px-2 py-1 rounded">
                          {childCategory.articleCount || 0}
                        </span>
                      </div>
                    </div>
                    
                    {childHasChildren && childIsExpanded && (
                      <div className="ml-4 border-l border-[#ffd230] pl-2 space-y-1">
                        {childCategory.children!.map((grandChildCategory) => {
                          const grandChildIsSelected = selectedCategory === grandChildCategory.slug;
                          
                          return (
                            <div 
                              key={grandChildCategory.id} 
                              className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-amber-100 text-xs ${grandChildIsSelected ? 'bg-amber-200 font-medium' : ''}`}
                              onClick={() => onCategorySelect(grandChildCategory.slug)}
                            >
                              <div className="flex items-center min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground"></span>
                                  <span className="font-medium truncate" style={{fontSize: 'var(--text-sm)', lineHeight: 'var(--tw-leading, var(--text-sm--line-height))'}}>{grandChildCategory.title}</span>
                                </span>
                              </div>
                              <div className="flex items-center ml-2">
                                <span className="text-xs bg-[#b2dd8b] px-2 py-1 rounded">
                                  {grandChildCategory.articleCount || 0}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    };
    
    return (
      <div className="space-y-1">
        {categories.map(renderCategory)}
        {/* Insert Tree/List/Create Article buttons after the Favorites category */}
        {categories.some(cat => cat.slug === 'favorites') && (
          <>
            <div className="p-4 border-t border-[#dedede] flex gap-2">
              <Button
                variant={showTreeView ? "default" : "outline"}
                size="sm"
                onClick={() => setShowTreeView(true)}
                className="flex-1"
              >
                {t('articles:treeView.treeView')}
              </Button>
              <Button
                variant={!showTreeView ? "default" : "outline"}
                size="sm"
                onClick={() => setShowTreeView(false)}
                className="flex-1"
              >
                {t('articles:treeView.listView')}
              </Button>
            </div>
            
            <div className="p-4 border-t border-[#dedede]">
              {user && (
                <Button className="w-full" asChild>
                  <Link href="/articles/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('articles:createArticle')}
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const CategoryList: React.FC<{
    categories: ArticleCategory[];
    onCategorySelect: (category: string | null) => void;
    selectedCategory: string | null;
    showOnlyWithNew: boolean;
  }> = ({
    categories,
    onCategorySelect,
    selectedCategory,
    showOnlyWithNew
  }) => {
    const flattenCategories = (cats: ArticleCategory[]): ArticleCategory[] => {
      let result: ArticleCategory[] = [];
      for (const cat of cats) {
        result.push(cat);
        if (cat.children && cat.children.length > 0) {
          result = result.concat(flattenCategories(cat.children));
        }
      }
      return result;
    };

    const flattenedCategories = flattenCategories(categories);

    // Filter categories based on showOnlyWithNew
    const filteredCategories = showOnlyWithNew 
      ? flattenedCategories.filter(cat => (cat.articleCount || 0) > 0)
      : flattenedCategories;

    const hasNewArticles = (slug: string) => {
      const category = flattenedCategories.find(c => c.slug === slug);
      return category && (category.articleCount || 0) > 0;
    };

    return (
      <div className="space-y-1">
        {filteredCategories.map((category) => {
          const isSelected = selectedCategory === category.slug;
          const articleCount = category.articleCount || 0;
          
          return (
            <div 
              key={category.id} 
              className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-amber-100 ${isSelected ? 'bg-amber-200 font-medium' : ''}`}
              onClick={() => onCategorySelect(category.slug)}
            >
              <div className="flex items-center min-w-0 flex-1">
                <span className="font-medium truncate" style={{fontSize: 'var(--text-sm)', lineHeight: 'var(--tw-leading, var(--text-sm--line-height))'}}>{category.title}</span>
              </div>
              <div className="flex items-center ml-2">
                <span className="text-xs bg-[#b2dd8b] px-2 py-1 rounded">
                  {articleCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="w-80 bg-[#fffaf7] border-r border-[#dedede] flex flex-col">
      <div className="p-4 border-b border-[#dedede] flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: '#ff8417', textShadow: '0px 0px 0px #c16200' }}>{t('articles:categories')}</h2>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/articles/new')}
            className="h-8 w-8"
            aria-label="Create new article"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="h-8 w-8"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-4 border-b border-[#dedede]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('articles:searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          
          
          {showTreeView ? (
            <CategoryTree 
              categories={filteredCategories}
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
              onCategorySelect={setSelectedCategory}
              selectedCategory={selectedCategory}
              showOnlyWithNew={showOnlyWithNew}
            />
          ) : (
            <CategoryList 
              categories={filteredCategories}
              onCategorySelect={setSelectedCategory}
              selectedCategory={selectedCategory}
              showOnlyWithNew={showOnlyWithNew}
            />
          )}
        </div>
      </div>

    </div>
  );
});

interface ArticleCategory {
  id: string;
  parentId: string | null;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  articleCount?: number;
  newArticleCount?: number;
  children?: ArticleCategory[];
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentJson?: any; // Add contentJson for full article view
  author?: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  section: string | null;  // New enum field
  format: string | null;      // New enum field
  lang: string;
  tags: Array<{ id?: string; axis?: string; name: string; slug: string }>;
  views: number;
  commentsCount: number;
  likes: number;
  createdAt: string;
  publishedAt: string | null;
  isReadLater?: boolean;
  bookmarkCount?: number;
}

export function ArticlesPage() {
  const { t, i18n } = useTranslation(['articles', 'common', 'profile']);
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [singleArticle, setSingleArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [showTreeView, setShowTreeView] = useState(true);
  const [showOnlyWithNew, setShowOnlyWithNew] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Comments and Reactions state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [expandingReply, setExpandingReply] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [articleReactions, setArticleReactions] = useState<ArticleReaction | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  
  // Function to toggle category expansion
  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Extract article ID from URL if present (both query param and hash fragment)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const articleIdParam = urlParams.get('article');
    
    // Use article ID from query parameter
    if (articleIdParam) {
      // Set the article immediately to trigger the load
      setSelectedArticle(articleIdParam);
    }
  }, []);

  // Track pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);

  // We'll use the articleCount from the categories themselves
  // const [categoryCounts, setCategoryCounts] = useState<Record<string, { count: number, newCount: number }>>({});

  const toggleReadLater = async (articleId: string, currentStatus: boolean | undefined) => {
    try {
      const method = currentStatus ? 'DELETE' : 'POST';
      const response = await fetch(`/api/articles/${articleId}/read-later`, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      
      if (response.ok) {
        // Update the local state optimistically for both isReadLater status and bookmark count
        const updatedBookmarkCount = currentStatus ? -1 : 1;
        if (singleArticle && singleArticle.id === articleId) {
          // Optimistically update both isReadLater and bookmark count
          const newBookmarkCount = Math.max(0, (singleArticle.bookmarkCount || 0) + updatedBookmarkCount);
          setSingleArticle({
            ...singleArticle,
            isReadLater: !currentStatus,
            bookmarkCount: newBookmarkCount
          });
        } else {
          setArticles(prev => prev.map(article => 
            article.id === articleId ? { 
              ...article, 
              isReadLater: !currentStatus,
              bookmarkCount: Math.max(0, (article.bookmarkCount || 0) + updatedBookmarkCount)
            } : article
          ));
        }
        
        // Calculate favorites count
        let favoritesCount = 0;
        if (user && localStorage.getItem("authToken")) {
          try {
            // Use the working articles endpoint with isReadLater parameter to get the count
            const favoritesResponse = await fetch('/api/articles?isReadLater=true&page=1&limit=1', {
              headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
            });
            if (favoritesResponse.ok) {
              const favoritesData = await favoritesResponse.json();
              favoritesCount = favoritesData.total || 0;
            } else {
              console.error('Failed to fetch favorites count:', favoritesResponse.status, favoritesResponse.statusText);
            }
          } catch (favError) {
            console.error('Error loading favorites count:', favError);
          }
        }
        
        // Update the categories array by replacing the existing favorites category with the new count
        setCategories(prevCategories => {
          const updatedCategories = prevCategories.filter(cat => cat.slug !== 'favorites');
          
          // Add Favorites category to the end of the list with the updated count
          const favoritesCategory = {
            id: 'favorites-category',
            parentId: null,
            title: t('articles:favorites'),
            titleEn: 'Favorites',
            description: t('articles:favorites'),
            descriptionEn: 'Favorites',
            slug: 'favorites',
            sortOrder: 9999, // Ensure it appears at the end
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            articleCount: favoritesCount
          };
          
          return [...updatedCategories, favoritesCategory];
        });
      }
    } catch (error) {
      console.error('Error toggling read later status:', error);
    }
  };
  
  // Function to load comments for an article
  const loadComments = async (articleId: string) => {
    if (!articleId) return;
    
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/articles/${articleId}/comments`, {
        headers: user ? { Authorization: `Bearer ${localStorage.getItem('authToken')}` } : undefined,
      });
      
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      } else {
        console.error('Failed to load comments:', response.status, response.statusText);
        setComments([]);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };
  
  
  // Function to submit a new comment
  const submitComment = async () => {
    if (!commentInput.trim() || !singleArticle?.id || submitting) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch(`/api/articles/${singleArticle.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          content: commentInput.trim()
        })
      });
      
      if (response.ok) {
        setCommentInput('');
        // Reload comments to include the new one
        await loadComments(singleArticle.id);
        
        // Update the article's comment count
        if (singleArticle) {
          setSingleArticle({
            ...singleArticle,
            commentsCount: (singleArticle.commentsCount || 0) + 1
          });
        }
      } else {
        console.error('Failed to submit comment:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Function to toggle like on a comment
  const toggleCommentReaction = async (commentId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}/reaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoji })
      });
      
      if (response.ok) {
        const updatedReaction = await response.json();
        
        // Update the comments list with the new reactions
        setComments(prev => updateCommentReactions(prev, commentId, updatedReaction.reactions));
      }
    } catch (error) {
      console.error('Error toggling comment reaction:', error);
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    // Delegate to the new reaction function with thumbs up emoji
    toggleCommentReaction(commentId, '👍');
  };
  
  // Helper function to update nested replies
  const updateNestedReply = (replies: Comment[], parentCommentId: string, newReply: Comment): Comment[] => {
    return replies.map(reply => {
      if (reply.id === parentCommentId) {
        return {
          ...reply,
          replies: [newReply, ...(reply.replies || [])],
          replyCount: (reply.replyCount || 0) + 1
        };
      }
      if (reply.replies && reply.replies.length > 0) {
        const updatedSubReplies = updateNestedReply(reply.replies, parentCommentId, newReply);
        if (updatedSubReplies !== reply.replies) {
          return {
            ...reply,
            replies: updatedSubReplies
          };
        }
      }
      return reply;
    });
  };
  
  // Function to load article reactions
  const loadArticleReactions = async (articleId: string) => {
    if (!articleId) return;
    
    try {
      const response = await fetch(`/api/articles/${articleId}/reactions`, {
        headers: user ? { Authorization: `Bearer ${localStorage.getItem('authToken')}` } : undefined,
      });
      
      if (response.ok) {
        const data = await response.json();
        setArticleReactions(data);
      } else {
        console.error('Failed to load article reactions:', response.status, response.statusText);
        setArticleReactions(null);
      }
    } catch (error) {
      console.error('Error loading article reactions:', error);
      setArticleReactions(null);
    }
  };
  
  // Function to start replying to a comment
  const startReply = (comment: Comment) => {
    setReplyingTo(comment);
    setReplyInput('');
  };
  
  // Function to cancel replying
  const cancelReply = () => {
    setReplyingTo(null);
    setReplyInput('');
  };
  
  // Helper function to find the main comment ID for a given reply ID
  const findMainCommentIdForReply = (comments: Comment[], replyId: string): string | null => {
    for (const comment of comments) {
      // If the main comment is the one we're replying to
      if (comment.id === replyId) {
        return comment.id; // This is a main comment
      }
      
      // Check if the reply is directly under this main comment
      if (comment.replies && comment.replies.some(reply => reply.id === replyId)) {
        return comment.id; // Return the main comment ID
      }
      
      // Check nested replies recursively
      if (comment.replies) {
        const result = findMainCommentIdForReplyHelper(comment.replies, comment.id, replyId);
        if (result) return result;
      }
    }
    return null;
  };
  
  // Helper function to find main comment ID for nested replies
  const findMainCommentIdForReplyHelper = (replies: Comment[], mainCommentId: string, targetReplyId: string): string | null => {
    for (const reply of replies) {
      // If this reply is the one we're replying to
      if (reply.id === targetReplyId) {
        return mainCommentId; // Return the main comment ID
      }
      
      // Check if target is a direct child of this reply
      if (reply.replies && reply.replies.some(nestedReply => nestedReply.id === targetReplyId)) {
        return mainCommentId; // Return the main comment ID
      }
      
      // Recursively check deeper levels
      if (reply.replies) {
        const result = findMainCommentIdForReplyHelper(reply.replies, mainCommentId, targetReplyId);
        if (result) return result;
      }
    }
    return null;
  };
  
  // Helper function to find main comment ID in nested structure
  const findReplyInNestedStructure = (replies: Comment[], replyId: string): string | null => {
    for (const reply of replies) {
      if (reply.id === replyId) {
        // This shouldn't happen in this context since we're looking for parent
        return null;
      }
      
      // Check if any of this reply's children is the target
      if (reply.replies && reply.replies.some(nestedReply => nestedReply.id === replyId)) {
        return reply.id; // Return the parent reply ID
      }
      
      // Continue searching in deeper levels
      if (reply.replies) {
        const result = findReplyInNestedStructure(reply.replies, replyId);
        if (result) return result;
      }
    }
    return null;
  };
  
  // Function to submit a reply
  const submitReply = async (parentCommentId: string) => {
    if (!user || !singleArticle?.id || !replyInput.trim() || !replyingTo) return;
    
    try {
      const response = await fetch(`/api/articles/${singleArticle.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          content: replyInput,
          parentCommentId: parentCommentId,
          quotedText: replyingTo.content
        }),
      });
      
      if (response.ok) {
        const newReply = await response.json();
        
        // Recursive function to add reply to parent comment at any depth
        const addReplyToParent = (comment: Comment, parentId: string, newReply: any): Comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replyCount: (comment.replyCount || 0) + 1,
              replies: [...(comment.replies || []), newReply]
            };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: comment.replies.map(reply => addReplyToParent(reply, parentId, newReply))
            };
          }
          return comment;
        };
        
        setComments(prev => prev.map(c => addReplyToParent(c, parentCommentId, newReply)));
        
        // Ensure the reply sections are expanded so the new reply is visible
        const mainCommentId = findMainCommentIdForReply(comments, parentCommentId);
        if (mainCommentId) {
          setExpandedReplies(prev => new Set(prev).add(mainCommentId));
        }
        
        // Expand the parent comment to ensure the new reply is visible in nested threads
        setExpandedReplies(prev => new Set(prev).add(parentCommentId));
        
        // Force a re-render by updating the expandedReplies state with the parent
        // This ensures nested reply threads are visible after adding a reply
        setTimeout(() => {
          setExpandedReplies(prev => new Set(prev));
        }, 10); // Small delay to ensure DOM update
        
        // Clear reply form
        setReplyInput('');
        setReplyingTo(null);
      } else {
        console.error('Failed to submit reply:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
    }
  };
  
  // Helper function to update comment likes in nested structure
  const updateCommentLikes = (comments: Comment[], commentId: string, newLikes: number, newUserLiked: boolean): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          likes: newLikes,
          userLiked: newUserLiked
        };
      }
      // Update in nested replies if needed
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentLikes(comment.replies, commentId, newLikes, newUserLiked)
        };
      }
      return comment;
    });
  };

  // Helper function to update comment reactions in nested structure
  const updateCommentReactions = (comments: Comment[], commentId: string, reactions: any[]): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          reactions
        };
      }
      // Update in nested replies if needed
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentReactions(comment.replies, commentId, reactions)
        };
      }
      return comment;
    });
  };

  // Function to toggle reply expansion
  const toggleReplyExpansion = (commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };
  
  // Function to toggle like on an article
  const toggleArticleLike = async () => {
    if (!singleArticle?.id) return;
    
    try {
      const response = await fetch(`/api/articles/${singleArticle.id}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setArticleReactions(data);
        
        // Update the single article with new like count
        if (singleArticle) {
          setSingleArticle({
            ...singleArticle,
            likes: data.likes
          });
        }
      }
    } catch (error) {
      console.error('Error toggling article like:', error);
    }
  };

  // Function to toggle reaction on an article
  const toggleArticleReaction = async (emoji: string) => {
    if (!singleArticle?.id) return;
            
    try {
      const response = await fetch(`/api/articles/${singleArticle.id}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Emoji: emoji })
      });
              
      if (response.ok) {
        const data = await response.json();
                    
        // Update the single article with new like count
        if (singleArticle) {
          setSingleArticle({
            ...singleArticle,
            likes: data.likes || data.reactions?.reduce((sum: number, r: any) => sum + r.count, 0) || 0
          });
        }
                    
        // Update the article reactions with the data from the response
        setArticleReactions(data);
      }
    } catch (error) {
      console.error('Error toggling article reaction:', error);
    }
  };
  
  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/article-categories');
        const data = await response.json();
        
        // Calculate favorites count by fetching user's read later articles
        let favoritesCount = 0;
        if (user && localStorage.getItem("authToken")) {
          try {
            // Use the working articles endpoint with isReadLater parameter to get the count
            const favoritesResponse = await fetch('/api/articles?isReadLater=true&page=1&limit=1', {
              headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
            });
            if (favoritesResponse.ok) {
              const favoritesData = await favoritesResponse.json();
              favoritesCount = favoritesData.total || 0;
            } else {
              console.error('Failed to fetch initial favorites:', favoritesResponse.status, favoritesResponse.statusText);
            }
          } catch (favError) {
            console.error('Error loading favorites count:', favError);
          }
        }
        
        // Add Favorites category to the end of the list
        const favoritesCategory = {
          id: 'favorites-category',
          parentId: null,
          title: t('articles:favorites'),
          titleEn: 'Favorites',
          description: t('articles:favorites'),
          descriptionEn: 'Favorites',
          slug: 'favorites',
          sortOrder: 9999, // Ensure it appears at the end
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          articleCount: favoritesCount
        };
        
        setCategories([...data, favoritesCategory]);
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    };

    loadCategories();
  }, [t, user]); // Only reload categories when language or user changes
  
  // Update favorites count when selectedCategory is 'favorites'
  useEffect(() => {
    if (selectedCategory === 'favorites' && user && localStorage.getItem("authToken")) {
      const updateFavoritesCount = async () => {
        try {
          // Use the working articles endpoint with isReadLater parameter to get the count
          const favoritesResponse = await fetch('/api/articles?isReadLater=true&page=1&limit=1', {
            headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
          });
          if (favoritesResponse.ok) {
            const favoritesData = await favoritesResponse.json();
            const favoritesCount = favoritesData.total || 0;
            
            // Update the favorites category count
            setCategories(prev => {
              return prev.map(cat => 
                cat.slug === 'favorites' 
                  ? { ...cat, articleCount: favoritesCount }
                  : cat
              );
            });
          } else {
            console.error('Failed to fetch favorites count:', favoritesResponse.status, favoritesResponse.statusText);
          }
        } catch (error) {
          console.error('Error updating favorites count:', error);
        }
      };
      
      updateFavoritesCount();
    }
  }, [selectedCategory, user]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Load articles when page, search, or category changes
  useEffect(() => {
    if (selectedArticle) return; // Don't load articles list if viewing single article
    
    const loadArticles = async () => {
      try {
        setLoading(true);
        // Build query parameters
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: "12",
        });
        if (searchQuery) {
          // When searching, ignore the selected category and search all categories
          params.set("search", searchQuery);
        } else if (selectedCategory === 'favorites') {
          // Special handling for favorites - fetch only articles where isReadLater is true
          params.set('isReadLater', 'true');
        } else if (selectedCategory) {
          // Get all descendant slugs for the selected category
          const getAllDescendantSlugs = (parentId: string): string[] => {
            const directChildren = categories.filter(cat => cat.parentId === parentId);
            let allDescendants: string[] = [];
            
            for (const child of directChildren) {
              allDescendants.push(child.slug);
              // Recursively get all descendants of this child
              allDescendants = [...allDescendants, ...getAllDescendantSlugs(child.id)];
            }
            
            return allDescendants;
          };
          
          // Get all descendant slugs for the selected category
          const descendantSlugs = getAllDescendantSlugs(selectedCategory);
          
          // Include both the selected category and all its descendants in the filter
          if (descendantSlugs.length > 0) {
            params.set("section", [selectedCategory, ...descendantSlugs].join(","));
          } else {
            params.set("section", selectedCategory);
          }
        }

        const response = await fetch(`/api/articles?${params.toString()}`, {
          headers: user ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : undefined,
        });

        const data = await response.json();
        // Ensure likes and bookmarkCount properties are set for all articles, default to 0 if not present
        const articlesWithDefaults = (data.articles || []).map((article: Article) => ({
          ...article,
          likes: article.likes || 0,
          bookmarkCount: article.bookmarkCount || 0
        }));
        setArticles(articlesWithDefaults);
        setTotalPages(data.totalPages || 1);
        setTotalArticles(data.total || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, [currentPage, searchQuery, selectedCategory, user, categories, selectedArticle]);

  // Load single article when selected
  useEffect(() => {
    if (!selectedArticle) {
      setSingleArticle(null);
      return;
    }
    
    const loadSingleArticle = async () => {
      try {
        setLoadingArticle(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/articles/${selectedArticle}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        
        if (response.ok) {
          const data = await response.json();
          // Ensure likes and bookmarkCount properties are set, default to 0 if not present
          const articleWithDefaults = {
            ...data.article,
            likes: data.article.likes || 0,
            bookmarkCount: data.article.bookmarkCount || 0
          };
          setSingleArticle(articleWithDefaults);
          
          // If this article has a section/category, automatically select and expand it
          if (articleWithDefaults.section && categories.length > 0) {
            // Handle hierarchical sections like 'news.new-books' and non-hierarchical
            let articleCategory = null;
            
            // First, try to find exact match
            articleCategory = categories.find(cat => cat.slug === articleWithDefaults.section);
            
            if (!articleCategory) {
              // If section has dot notation (parent.child), try to find the child category
              if (articleWithDefaults.section.includes('.')) {
                const parts = articleWithDefaults.section.split('.');
                const parentPart = parts[0];
                const childPart = parts[1];
                
                // First try to find the child category that has a parentId matching the parent category
                const parentCategory = categories.find(cat => cat.slug === parentPart);
                if (parentCategory) {
                  // Find child category that belongs to this parent
                  articleCategory = categories.find(cat => cat.parentId === parentCategory.id && cat.slug === childPart);
                  
                  // If still not found, try to find child by title or other matching
                  if (!articleCategory) {
                    articleCategory = categories.find(cat => 
                      cat.parentId === parentCategory.id && 
                      (cat.slug.includes(childPart) || cat.title.toLowerCase().includes('новые') || cat.title.toLowerCase().includes('new'))
                    );
                  }
                  
                  // If still not found, try more specific Russian language matching
                  if (!articleCategory) {
                    articleCategory = categories.find(cat => 
                      cat.parentId === parentCategory.id && 
                      (cat.title.toLowerCase().includes('переводы') || cat.title.toLowerCase().includes('translations') || cat.title.toLowerCase().includes('новый переводы'))
                    );
                  }
                }
                
                // If still not found, try general matching
                if (!articleCategory) {
                  // Look for any category with the child part in its slug
                  articleCategory = categories.find(cat => cat.slug === childPart);
                  
                  if (!articleCategory && parentCategory) {
                    // Try to find by looking for categories with matching title in the same parent
                    articleCategory = categories.find(cat => 
                      cat.parentId === parentCategory.id &&
                      (cat.title.toLowerCase().includes(childPart) || 
                       cat.titleEn?.toLowerCase().includes(childPart) ||
                       cat.slug.includes(childPart))
                    );
                  }
                  
                  // Try to find by looking for Russian-specific terms in the child part
                  if (!articleCategory && parentCategory) {
                    articleCategory = categories.find(cat => 
                      cat.parentId === parentCategory.id && 
                      (cat.title.toLowerCase().includes('новый переводы') ||
                       cat.title.toLowerCase().includes('новости и переводы') ||
                       cat.title.toLowerCase().includes('переводы') ||
                       cat.title.toLowerCase().includes('translations'))
                    );
                  }
                  
                  // Final fallback: try to find any category with matching title
                  if (!articleCategory) {
                    articleCategory = categories.find(cat => 
                      cat.title.toLowerCase().includes(childPart) || 
                      cat.titleEn?.toLowerCase().includes(childPart)
                    );
                  }
                }
                
                if (!articleCategory) {
                  // Finally try to match parent category
                  articleCategory = categories.find(cat => cat.slug === parentPart);
                }
              } else {
                // If no dot notation, try to match the section directly to any category slug
                articleCategory = categories.find(cat => cat.slug === articleWithDefaults.section);
              }
            }
            
            if (articleCategory) {
              // Only update if it's different from current selection
              if (selectedCategory !== articleCategory.slug) {
                setSelectedCategory(articleCategory.slug);
              }
              
              // Expand parent category if it exists
              if (articleCategory.parentId) {
                const parentCategory = categories.find(cat => cat.id === articleCategory.parentId);
                if (parentCategory) {
                  setExpandedCategories(prev => {
                    const newSet = new Set(prev);
                    newSet.add(parentCategory.slug);
                    return newSet;
                  });
                }
              } else {
                // If it's a top-level category, just make sure it's expanded
                setExpandedCategories(prev => {
                  const newSet = new Set(prev);
                  newSet.add(articleCategory.slug);
                  return newSet;
                });
              }
            } else {
              // Even if we couldn't find the exact category, try to expand based on section
              if (articleWithDefaults.section) {
                if (articleWithDefaults.section.includes('.')) {
                  const parts = articleWithDefaults.section.split('.');
                  const parentPart = parts[0];
                  const parentCategory = categories.find(cat => cat.slug === parentPart);
                  if (parentCategory) {
                    setExpandedCategories(prev => {
                      const newSet = new Set(prev);
                      newSet.add(parentCategory.slug);
                      return newSet;
                    });
                  }
                } else {
                  // If no dot notation, try to find by section name directly
                  const category = categories.find(cat => cat.slug === articleWithDefaults.section);
                  if (category) {
                    setExpandedCategories(prev => {
                      const newSet = new Set(prev);
                      newSet.add(category.slug);
                      return newSet;
                    });
                  }
                }
              }
            }
          }
          
          // Load comments and reactions for the article
          await loadComments(selectedArticle);
          await loadArticleReactions(selectedArticle);
        }
      } catch (e) {
        console.error('Error loading article:', e);
      } finally {
        setLoadingArticle(false);
      }
    };
    
    loadSingleArticle();
  }, [selectedArticle, categories]);

  // Effect to handle category selection when categories are loaded after article
  useEffect(() => {
    // Only run if we have a single article loaded and categories are available
    if (singleArticle && categories.length > 0 && selectedArticle) {
      // Check if the currently selected category is still valid
      // If not, try to match the article to its category again
      const currentCategoryExists = categories.some(cat => cat.slug === selectedCategory);
      
      if (!currentCategoryExists) {
        // Try to find the category for the current article again
        let articleCategory: ArticleCategory | null = null;
        
        if (singleArticle.section) {
          // First, try to find exact match
          articleCategory = categories.find(cat => cat.slug === singleArticle.section) ?? null;
          
          if (!articleCategory) {
            // If section has dot notation (parent.child), try to find the child category
            if (singleArticle.section.includes('.')) {
              const parts = singleArticle.section.split('.');
              const parentPart = parts[0];
              const childPart = parts[1];
              
              // First try to find the child category that has a parentId matching the parent category
              const parentCategory = categories.find(cat => cat.slug === parentPart) ?? null;
              if (parentCategory) {
                // Find child category that belongs to this parent
                articleCategory = categories.find(cat => cat.parentId === parentCategory.id && cat.slug === childPart) ?? null;
                
                // If still not found, try to find child by title or other matching
                if (!articleCategory) {
                  articleCategory = categories.find(cat => 
                    cat.parentId === parentCategory.id && 
                    (cat.slug.includes(childPart) || cat.title.toLowerCase().includes('новые') || cat.title.toLowerCase().includes('new'))
                  ) ?? null;
                }
                
                // If still not found, try more specific Russian language matching
                if (!articleCategory) {
                  articleCategory = categories.find(cat => 
                    cat.parentId === parentCategory.id && 
                    (cat.title.toLowerCase().includes('переводы') || cat.title.toLowerCase().includes('translations') || cat.title.toLowerCase().includes('новый переводы'))
                  ) ?? null;
                }
              }
              
              // If still not found, try general matching
              if (!articleCategory) {
                // Look for any category with the child part in its slug
                articleCategory = categories.find(cat => cat.slug === childPart) ?? null;
                
                if (!articleCategory && parentCategory) {
                  // Try to find by looking for categories with matching title in the same parent
                  articleCategory = categories.find(cat => 
                    cat.parentId === parentCategory.id &&
                    (cat.title.toLowerCase().includes(childPart) || 
                     cat.titleEn?.toLowerCase().includes(childPart) ||
                     cat.slug.includes(childPart))
                  ) ?? null;
                }
                
                // Try to find by looking for Russian-specific terms in the child part
                if (!articleCategory && parentCategory) {
                  articleCategory = categories.find(cat => 
                    cat.parentId === parentCategory.id && 
                    (cat.title.toLowerCase().includes('новый переводы') ||
                     cat.title.toLowerCase().includes('новости и переводы') ||
                     cat.title.toLowerCase().includes('переводы') ||
                     cat.title.toLowerCase().includes('translations'))
                  ) ?? null;
                }
                
                // Final fallback: try to find any category with matching title
                if (!articleCategory) {
                  articleCategory = categories.find(cat => 
                    cat.title.toLowerCase().includes(childPart) || 
                    cat.titleEn?.toLowerCase().includes(childPart)
                  ) ?? null;
                }
              }
              
              if (!articleCategory) {
                // Finally try to match parent category
                articleCategory = categories.find(cat => cat.slug === parentPart) ?? null;
              }
            } else {
              // If no dot notation, try to match the section directly to any category slug
              articleCategory = categories.find(cat => cat.slug === singleArticle.section) ?? null;
            }
          }
          
          if (articleCategory) {
            // Only update if it's different from current selection
            if (selectedCategory !== articleCategory.slug) {
              setSelectedCategory(articleCategory.slug);
            }
                        
            // Expand all ancestors of this category up to the root
            const expandAllAncestors = (categoryId: string) => {
              const category = categories.find(cat => cat.id === categoryId);
              if (category) {
                // Expand this category
                setExpandedCategories(prev => {
                  const newSet = new Set(prev);
                  newSet.add(category.slug);
                  return newSet;
                });
                            
                // Continue expanding up the chain if it has a parent
                if (category.parentId) {
                  expandAllAncestors(category.parentId); // Recursively expand up the chain
                }
              }
            };
                        
            // Expand the current category and all its ancestors
            expandAllAncestors(articleCategory.id);
            
            // Additionally, if the selected category has a parent, make sure it's expanded
            if (articleCategory!.parentId) {
              const parentCategory = categories.find(cat => cat.id === articleCategory!.parentId);
              if (parentCategory) {
                setExpandedCategories(prev => {
                  const newSet = new Set(prev);
                  newSet.add(parentCategory.slug);
                  return newSet;
                });
              }
            }
            
            // Find and expand the root category by traversing up the hierarchy
            let currentCat = articleCategory;
            while (currentCat.parentId) {
              const parentCat = categories.find(cat => cat.id === currentCat.parentId);
              if (parentCat) {
                currentCat = parentCat;
              } else {
                break; // No more parents found
              }
            }
            
            // currentCat is now the root category, make sure it's expanded
            setExpandedCategories(prev => {
              const newSet = new Set(prev);
              newSet.add(currentCat.slug);
              return newSet;
            });
            
            // Additionally, ensure root categories are expanded
            // Find root categories and make sure they're expanded
            const rootCategories = categories.filter(cat => !cat.parentId);
            rootCategories.forEach(rootCat => {
              setExpandedCategories(prev => {
                const newSet = new Set(prev);
                newSet.add(rootCat.slug);
                return newSet;
              });
            });
          } else if (articleCategory) {
            // If we have a category but it's a top-level one (no parentId), just make sure it's expanded
            setExpandedCategories(prev => {
              const newSet = new Set(prev);
              newSet.add(articleCategory!.slug);
              return newSet;
            });
          } else {
            // Even if we couldn't find the exact category, try to expand based on section
            if (singleArticle.section) {
              if (singleArticle.section.includes('.')) {
                const parts = singleArticle.section.split('.');
                const parentPart = parts[0];
                const parentCategory = categories.find(cat => cat.slug === parentPart) ?? null;
                if (parentCategory) {
                  // Find all ancestors of this category and expand them
                  const expandAllAncestors = (categoryId: string) => {
                    const category = categories.find(cat => cat.id === categoryId);
                    if (category) {
                      // Expand this category
                      setExpandedCategories(prev => {
                        const newSet = new Set(prev);
                        newSet.add(category.slug);
                        return newSet;
                      });
                      
                      // Continue expanding up the chain if it has a parent
                      if (category.parentId) {
                        expandAllAncestors(category.parentId); // Recursively expand up the chain
                      }
                    }
                  };
                  
                  // Expand the parent category and all its ancestors
                  expandAllAncestors(parentCategory.id);
                  
                  // Additionally, if the selected category has a parent, make sure it's expanded
                  if (parentCategory!.parentId) {
                    const parentParentCategory = categories.find(cat => cat.id === parentCategory!.parentId);
                    if (parentParentCategory) {
                      setExpandedCategories(prev => {
                        const newSet = new Set(prev);
                        newSet.add(parentParentCategory.slug);
                        return newSet;
                      });
                    }
                  }
                  
                  // Additionally, ensure root categories are expanded
                  // Find root categories and make sure they're expanded
                  const rootCategories = categories.filter(cat => !cat.parentId);
                  rootCategories.forEach(rootCat => {
                    setExpandedCategories(prev => {
                      const newSet = new Set(prev);
                      newSet.add(rootCat.slug);
                      return newSet;
                    });
                  });
                }
              } else {
                // If no dot notation, try to find by section name directly
                const category = categories.find(cat => cat.slug === singleArticle.section) ?? null;
                if (category) {
                  // Find all ancestors of this category and expand them
                  const expandAllAncestors = (categoryId: string) => {
                    const category = categories.find(cat => cat.id === categoryId);
                    if (category) {
                      // Expand this category
                      setExpandedCategories(prev => {
                        const newSet = new Set(prev);
                        newSet.add(category.slug);
                        return newSet;
                      });
                      
                      // Continue expanding up the chain if it has a parent
                      if (category.parentId) {
                        expandAllAncestors(category.parentId); // Recursively expand up the chain
                      }
                    }
                  };
                  
                  // Expand the category and all its ancestors
                  expandAllAncestors(category.id);
                  
                  // Additionally, if the selected category has a parent, make sure it's expanded
                  if (category!.parentId) {
                    const parentCategory = categories.find(cat => cat.id === category!.parentId);
                    if (parentCategory) {
                      setExpandedCategories(prev => {
                        const newSet = new Set(prev);
                        newSet.add(parentCategory.slug);
                        return newSet;
                      });
                    }
                  }
                  
                  // Additionally, ensure root categories are expanded
                  // Find root categories and make sure they're expanded
                  const rootCategories = categories.filter(cat => !cat.parentId);
                  rootCategories.forEach(rootCat => {
                    setExpandedCategories(prev => {
                      const newSet = new Set(prev);
                      newSet.add(rootCat.slug);
                      return newSet;
                    });
                  });
                }
              }
            }
          }
        }
      }
    }
  }, [categories, singleArticle, selectedArticle, selectedCategory]);

  // Effect to ensure parent categories are expanded when a child category is selected
  useEffect(() => {
    if (selectedCategory && categories.length > 0) {
      // Find the selected category
      const selectedCat = categories.find(cat => cat.slug === selectedCategory);
      
      if (selectedCat) {
        // Find all ancestors of this category and expand them
        const expandAllAncestors = (categoryId: string) => {
          const category = categories.find(cat => cat.id === categoryId);
          if (category) {
            // Expand this category
            setExpandedCategories(prev => {
              const newSet = new Set(prev);
              newSet.add(category.slug);
              return newSet;
            });
            
            // Continue expanding up the chain if it has a parent
            if (category.parentId) {
              expandAllAncestors(category.parentId); // Recursively expand up the chain
            }
          }
        };
        
        // Expand the selected category and all its ancestors
        expandAllAncestors(selectedCat.id);
        
        // Additionally, if the selected category has a parent, make sure it's expanded
        if (selectedCat.parentId) {
          const parentCategory = categories.find(cat => cat.id === selectedCat.parentId);
          if (parentCategory) {
            setExpandedCategories(prev => {
              const newSet = new Set(prev);
              newSet.add(parentCategory.slug);
              return newSet;
            });
          }
        }
        
        // Additionally, ensure root categories are expanded
        // Find root categories and make sure they're expanded
        const rootCategories = categories.filter(cat => !cat.parentId);
        rootCategories.forEach(rootCat => {
          setExpandedCategories(prev => {
            const newSet = new Set(prev);
            newSet.add(rootCat.slug);
            return newSet;
          });
        });
      }
    }
  }, [selectedCategory, categories]);

  // Effect to handle parent category expansion immediately when selectedCategory changes
  useEffect(() => {
    if (selectedCategory && categories.length > 0) {
      // Find all ancestors of the selected category and expand them
      const expandAllAncestors = (categoryId: string) => {
        const category = categories.find(cat => cat.id === categoryId);
        if (category) {
          // Expand this category
          setExpandedCategories(prev => {
            const newSet = new Set(prev);
            newSet.add(category.slug);
            return newSet;
          });
          
          // Continue expanding up the chain if it has a parent
          if (category.parentId) {
            expandAllAncestors(category.parentId); // Recursively expand up the chain
          }
        }
      };
      
      const selectedCat = categories.find(cat => cat.slug === selectedCategory);
      
      if (selectedCat) {
        // Expand the selected category and all its ancestors
        expandAllAncestors(selectedCat.id);
        
        // Additionally, if the selected category has a parent, make sure it's expanded
        if (selectedCat.parentId) {
          const parentCategory = categories.find(cat => cat.id === selectedCat.parentId);
          if (parentCategory) {
            setExpandedCategories(prev => {
              const newSet = new Set(prev);
              newSet.add(parentCategory.slug);
              return newSet;
            });
          }
        }
        
        // Additionally, ensure root categories are expanded
        // Find root categories and make sure they're expanded
        const rootCategories = categories.filter(cat => !cat.parentId);
        rootCategories.forEach(rootCat => {
          setExpandedCategories(prev => {
            const newSet = new Set(prev);
            newSet.add(rootCat.slug);
            return newSet;
          });
        });
        
        // As a final guarantee, also expand the parent of the selected category
        // Find the selected category and ensure its parent is expanded
        const currentSelectedCat = categories.find(cat => cat.slug === selectedCategory);
        if (currentSelectedCat && currentSelectedCat.parentId) {
          const parentCategory = categories.find(cat => cat.id === currentSelectedCat.parentId);
          if (parentCategory) {
            setExpandedCategories(prev => {
              const newSet = new Set(prev);
              newSet.add(parentCategory.slug);
              return newSet;
            });
          }
        }
      }
    }
  }, [selectedCategory, categories]); // Include categories to ensure it runs when categories change

  // Additional effect to ensure parent category is expanded when single article is loaded
  useEffect(() => {
    if (singleArticle && categories.length > 0 && selectedCategory) {
      // Find the selected category
      const selectedCat = categories.find(cat => cat.slug === selectedCategory);
      
      if (selectedCat && selectedCat.parentId) {
        // Find the parent category
        const parentCategory = categories.find(cat => cat.id === selectedCat.parentId);
        
        if (parentCategory) {
          // Make sure the parent category is expanded
          setExpandedCategories(prev => {
            const newSet = new Set(prev);
            newSet.add(parentCategory.slug);
            return newSet;
          });
        }
      }
    }
  }, [singleArticle, categories, selectedCategory]);

  // Effect to ensure parent category of selected subcategory is expanded when both article and categories are loaded
  useEffect(() => {
    if (selectedCategory && categories.length > 0) {
      // Find the selected category
      const selectedCat = categories.find(cat => cat.slug === selectedCategory);
      
      if (selectedCat && selectedCat.parentId) {
        // Find the parent category
        const parentCategory = categories.find(cat => cat.id === selectedCat.parentId);
        
        if (parentCategory) {
          // Make sure the parent category is expanded
          setExpandedCategories(prev => {
            const newSet = new Set(prev);
            newSet.add(parentCategory.slug);
            return newSet;
          });
        }
      }
      
      // Additionally, find all ancestors and make sure they're expanded
      if (selectedCat) {
        let currentCat = selectedCat;
        while (currentCat.parentId) {
          const parentCat = categories.find(cat => cat.id === currentCat.parentId);
          if (parentCat) {
            // Make sure this parent is expanded
            setExpandedCategories(prev => {
              const newSet = new Set(prev);
              newSet.add(parentCat.slug);
              return newSet;
            });
            currentCat = parentCat;
          } else {
            break; // No more parents found
          }
        }
      }
      
      // Final guarantee: ensure root categories are expanded
      const rootCategories = categories.filter(cat => !cat.parentId);
      rootCategories.forEach(rootCat => {
        setExpandedCategories(prev => {
          const newSet = new Set(prev);
          newSet.add(rootCat.slug);
          return newSet;
        });
      });
    }
  }, [selectedCategory, categories]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language === 'ru' ? ru : enUS;
    return format(date, 'MMM d, yyyy', { locale });
  };

  // Function to build category tree
  const buildCategoryTree = () => {
    const rootCategories = categories.filter(cat => !cat.parentId);
    const childCategories = categories.filter(cat => cat.parentId);
    
    // Separate the favorites category
    const favoritesCategory = categories.find(cat => cat.slug === 'favorites');
    const otherRootCategories = rootCategories.filter(cat => cat.slug !== 'favorites');
    
    const tree = otherRootCategories.map(rootCat => ({
      ...rootCat,
      children: childCategories.filter(child => child.parentId === rootCat.id)
    }));
    
    // Add favorites category at the end
    if (favoritesCategory) {
      tree.push({...favoritesCategory, children: []});
    }
    
    return tree;
  };

  // Function to get article count for a category
  const getCategoryArticleCount = (slug: string) => {
    const category = categories.find(cat => cat.slug === slug);
    return category?.articleCount || 0;
  }

  // Function to check if a category has new articles
  const hasNewArticles = (slug: string) => {
    const category = categories.find(cat => cat.slug === slug);
    return (category?.newArticleCount || 0) > 0;
  }

  // Filter categories based on showOnlyWithNew flag
  const filteredCategories = showOnlyWithNew 
    ? buildCategoryTree().filter(cat => hasNewArticles(cat.slug) || 
        cat.children.some(child => hasNewArticles(child.slug)))
    : buildCategoryTree();

  // Handle category selection
  const handleCategorySelect = (slug: string | null) => {
    // Special handling for favorites category
    if (slug === 'favorites') {
      setSelectedCategory('favorites');
      setSearchQuery(''); // Clear search when category changes
      setSelectedArticle(null); // Deselect article when category changes
      setCurrentPage(1);
    } else {
      setSelectedCategory(slug);
      setSearchQuery(''); // Clear search when category changes
      setSelectedArticle(null); // Deselect article when category changes
      setCurrentPage(1);
    }
  };

  // Handle article selection
  const handleArticleSelect = (id: string) => {
    setSelectedArticle(id);
    
    // Update URL to include article ID for direct linking
    const url = new URL(window.location.href);
    url.searchParams.set('article', id);
    window.history.replaceState({}, '', url.toString());
  };

  // Render article content based on contentJson
  const renderArticleContent = (content: any) => {
    if (!content || !content.content || !Array.isArray(content.content)) {
      return <div>No content available</div>;
    }
    
    return content.content.map((node: any, index: number) => {
      switch (node.type) {
        case 'paragraph':
          return (
            <p key={index} className="mb-4">
              {node.content?.map((textNode: any, textIndex: number) => {
                if (textNode.type === 'text') {
                  return textNode.marks && textNode.marks.some((mark: any) => mark.type === 'bold') ? 
                    <strong key={textIndex}>{textNode.text}</strong> :
                    textNode.marks && textNode.marks.some((mark: any) => mark.type === 'italic') ?
                    <em key={textIndex}>{textNode.text}</em> :
                    textNode.text;
                }
                return textNode.text || '';
              })}
            </p>
          );
        case 'heading':
          const level = node.attrs?.level || 2;
          switch(level) {
            case 1:
              return <h1 key={index} className="mt-6 mb-4">{node.content?.[0]?.text || 'Heading'}</h1>;
            case 2:
              return <h2 key={index} className="mt-6 mb-4">{node.content?.[0]?.text || 'Heading'}</h2>;
            case 3:
              return <h3 key={index} className="mt-6 mb-4">{node.content?.[0]?.text || 'Heading'}</h3>;
            case 4:
              return <h4 key={index} className="mt-6 mb-4">{node.content?.[0]?.text || 'Heading'}</h4>;
            case 5:
              return <h5 key={index} className="mt-6 mb-4">{node.content?.[0]?.text || 'Heading'}</h5>;
            case 6:
              return <h6 key={index} className="mt-6 mb-4">{node.content?.[0]?.text || 'Heading'}</h6>;
            default:
              return <h2 key={index} className="mt-6 mb-4">{node.content?.[0]?.text || 'Heading'}</h2>;
          }
        case 'bulletList':
          return (
            <ul key={index} className="list-disc list-inside mb-4">
              {node.content?.map((listItem: any, liIndex: number) => (
                <li key={liIndex}>
                  {listItem.content?.[0]?.content?.map((textNode: any, textIndex: number) => {
                    if (textNode.type === 'text') {
                      return textNode.marks && textNode.marks.some((mark: any) => mark.type === 'bold') ? 
                        <strong key={textIndex}>{textNode.text}</strong> :
                        textNode.marks && textNode.marks.some((mark: any) => mark.type === 'italic') ?
                        <em key={textIndex}>{textNode.text}</em> :
                        textNode.text;
                    }
                    return textNode.text || '';
                  })}
                </li>
              ))}
            </ul>
          );
        case 'orderedList':
          return (
            <ol key={index} className="list-decimal list-inside mb-4">
              {node.content?.map((listItem: any, liIndex: number) => (
                <li key={liIndex}>
                  {listItem.content?.[0]?.content?.map((textNode: any, textIndex: number) => {
                    if (textNode.type === 'text') {
                      return textNode.marks && textNode.marks.some((mark: any) => mark.type === 'bold') ? 
                        <strong key={textIndex}>{textNode.text}</strong> :
                        textNode.marks && textNode.marks.some((mark: any) => mark.type === 'italic') ?
                        <em key={textIndex}>{textNode.text}</em> :
                        textNode.text;
                    }
                    return textNode.text || '';
                  })}
                </li>
              ))}
            </ol>
          );
        default:
          return null;
      }
    });
  };

  if (loadingArticle || (selectedArticle && !singleArticle)) {
    return (
      <div className="flex h-screen">
        {sidebarOpen && (
          <div className="w-80 bg-[#fffaf7] border-r border-[#dedede] flex flex-col">
            <div className="p-4 border-b border-[#dedede]">
              <h2 className="text-xl font-bold" style={{ color: '#ff8417', textShadow: '0px 0px 0px #c16200' }}>{t('articles:categories')}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full mb-2" />
            </div>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">{t('articles:loadingArticle')}</p>
          </div>
        </div>
        {!sidebarOpen && (
          <div className="absolute top-4 left-4 z-10 p-1 bg-background rounded-md border">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8"
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      {sidebarOpen && (
        <SidebarComponent
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          t={t}
          categories={categories}
          expandedCategories={expandedCategories}
          toggleCategory={toggleCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={handleCategorySelect}
          showTreeView={showTreeView}
          setShowTreeView={setShowTreeView}
          showOnlyWithNew={showOnlyWithNew}
          setShowOnlyWithNew={setShowOnlyWithNew}
          filteredCategories={filteredCategories}
          user={user}
          navigate={navigate}
        />
      )}
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!sidebarOpen && (
          <div className="p-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8"
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-4">
          {selectedArticle ? (
            // Single Article View
            singleArticle ? (
              <div className="w-full">
                <div className="mb-6">
                  <div>
                  </div>
                  
                  <h1 className="text-3xl font-bold mb-1">{singleArticle.title}</h1>
                  
                  {singleArticle.section && (
                    <p className="text-sm text-muted-foreground mb-3">
                      <button 
                        onClick={() => {
                          // Find the category by slug
                          const category = categories.find(cat => cat.slug === singleArticle.section);
                          if (category) {
                            // Expand the category and its ancestors
                            const expandAncestors = (categoryId: string) => {
                              const cat = categories.find(c => c.id === categoryId);
                              if (cat) {
                                setExpandedCategories(prev => {
                                  const newSet = new Set(prev);
                                  newSet.add(cat.slug);
                                  return newSet;
                                });
                                if (cat.parentId) {
                                  expandAncestors(cat.parentId);
                                }
                              }
                            };
                            
                            // Expand the category and its ancestors
                            if (category.parentId) {
                              expandAncestors(category.parentId);
                            }
                            
                            // Set the selected category
                            setSelectedCategory(category.slug);
                            
                            // Deselect the article to go back to the category view
                            setSelectedArticle(null);
                            
                            // Update URL to remove article parameter
                            const url = new URL(window.location.href);
                            url.searchParams.delete('article');
                            window.history.replaceState({}, '', url.toString());
                          }
                        }}
                        className="hover:text-foreground hover:underline cursor-pointer"
                      >
                        {t('articles:editor.sections.' + singleArticle.section)}
                      </button>
                    </p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      {singleArticle.author?.avatarUrl ? (
                        <img 
                          src={singleArticle.author.avatarUrl} 
                          alt={singleArticle.author.username}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {(singleArticle.author?.username || singleArticle.author?.fullName || "Reader").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {singleArticle.author?.id ? <span>{t('articles:byAuthor')} <Link href={`/profile/${singleArticle.author.id}`} className="hover:underline">{singleArticle.author.fullName || singleArticle.author.username || "Reader"}</Link></span> : <span>{t('articles:byAuthor')} {singleArticle.author?.fullName || singleArticle.author?.username || "Reader"}</span>}
                    </div>
                    
                    {singleArticle.publishedAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(singleArticle.publishedAt)}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{singleArticle.views}</span>
                    </div>
                    
                    {/* Bookmark count */}
                    {user ? (
                      <button 
                        onClick={() => toggleReadLater(singleArticle.id, singleArticle.isReadLater)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={singleArticle.isReadLater ? t('articles:removeFromReadLater') : t('articles:addToReadLater')}
                      >
                        <Bookmark 
                          className={`h-4 w-4 ${singleArticle.isReadLater ? 'fill-current text-primary' : ''}`} 
                        />
                        <span className="text-sm text-muted-foreground">{singleArticle.bookmarkCount || 0}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Bookmark className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{singleArticle.bookmarkCount || 0}</span>
                      </div>
                    )}
                    

                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    {(singleArticle.tags || []).slice(0, 5).map((tag) => (
                      <Badge key={tag.slug} variant="secondary" className="text-xs">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="prose max-w-none">
                  {renderArticleContent(singleArticle.contentJson)}
                </div>
                
                {/* Article Reactions */}
                <div className="mt-8 pt-6 border-t">
                  <div className="flex items-center gap-4">
                    <ReactionBar
                      reactions={articleReactions?.reactions || []}
                      onReact={(emoji: string) => toggleArticleReaction(emoji)}
                      articleId={singleArticle?.id}
                    />
                    
                    <div className="text-sm text-muted-foreground">
                      {singleArticle.commentsCount || 0} {t('articles:comments')}
                    </div>
                  </div>
                </div>
                
                {/* Comments Section */}
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4">{t('articles:comments')}</h3>
                  
                  {/* Main Comment Form */}
                  {user ? (
                    <div className="flex gap-4 mb-6">
                      <Avatar className="flex-shrink-0 w-10 h-10">
                        {user?.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt={user.fullName || user.username} />
                        ) : null}
                        <AvatarFallback>
                          {(user.fullName || user.username)?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <textarea
                          placeholder={t('articles:addCommentPlaceholder')}
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              e.preventDefault();
                              submitComment();
                            }
                          }}
                          className="w-full px-3 py-2 text-sm min-h-[100px] bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                        />
                        <div className="flex justify-between items-center">
                          <div className="flex gap-1">
                            <EmojiPicker
                              onEmojiSelect={(emoji) => setCommentInput(prev => prev + emoji)}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Ctrl+Enter</span>
                            <Button 
                              onClick={submitComment} 
                              disabled={!commentInput.trim() || submitting}
                              className="gap-2"
                            >
                              <Send className="w-4 h-4" />
                              {t('articles:postComment')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <AuthPrompt 
                      message={t('common:authPromptComments')} 
                      variant="card"
                    />
                  )}
                  
                  {/* Comments List */}
                  {loadingComments ? (
                    <div className="text-center py-8">
                      <p>{t('common:loading')}</p>
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>{t('articles:noComments')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className={`rounded-lg border p-4 ${user && comment.userId === user.id ? 'bg-[#fbf6f0] dark:bg-[#2a2520]' : 'bg-card'}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              <Avatar className="flex-shrink-0 w-10 h-10">
                                {comment.userAvatar ? (
                                  <AvatarImage src={comment.userAvatar} alt={comment.author || comment.username} />
                                ) : null}
                                <AvatarFallback className="text-xs">
                                  {(comment.author || comment.username)?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className={`font-medium ${user && comment.userId === user.id ? 'text-[#2a2520] dark:text-[#fbf6f0]' : ''}`}>
                                  <Link 
                                    href={`/profile/${comment.userId}`}
                                    className="hover:underline"
                                  >
                                    {comment.author || comment.username}
                                  </Link>
                                  {user && comment.userId === user.id && (
                                    <span className="ml-2 text-sm text-[#5a5550] dark:text-[#cbc6c0]">(me)</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs text-muted-foreground cursor-help">
                                          {format(new Date(comment.createdAt), 'MMM d, yyyy', { locale: i18n.language === 'ru' ? ru : enUS })}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', { locale: i18n.language === 'ru' ? ru : enUS })}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {(comment.parentCommentAuthor && comment.parentCommentId) && (
                                    <span className="text-xs text-muted-foreground">
                                      · replying to {comment.parentCommentAuthor}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground cursor-help">
                                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: i18n.language === 'ru' ? ru : enUS })}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', { locale: i18n.language === 'ru' ? ru : enUS })}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          
                          {/* Quoted text */}
                          {comment.quotedText && (
                            <div className="bg-muted/50 border-l-2 border-muted-foreground/50 pl-2 py-1 italic text-muted-foreground rounded-r text-sm mb-2">
                              <span className="font-medium">{comment.parentCommentAuthor}:</span> {comment.quotedText}
                            </div>
                          )}
                          
                          <p className="mb-2 whitespace-pre-wrap">{comment.content}</p>
                          
                          {/* Actions row: Reply button + Reactions + Show replies */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {user && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => startReply(comment)}
                              >
                                <Reply className="w-3 h-3 mr-1" />
                                {t('articles:reply')}
                              </Button>
                            )}
                            
                            {comment.replyCount && comment.replyCount > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => toggleReplyExpansion(comment.id)}
                              >
                                {expandedReplies.has(comment.id) ? (
                                  <>
                                    <ChevronUp className="w-3 h-3 mr-1" />
                                    {t('articles:hideReplies')}
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3 mr-1" />
                                    {t('profile:ratings.repliesCount', { count: getTotalCommentReplyCount(comment) })}
                                  </>
                                )}
                              </Button>
                            )}
                            
                            <ReactionBar
                              reactions={comment.reactions || []}
                              onReact={(emoji: string) => toggleCommentReaction(comment.id, emoji)}
                              commentId={comment.id}
                            />
                          </div>
                          
                          {/* Inline reply input for main comment */}
                          {replyingTo?.id === comment.id && (
                            <div className="mt-2 space-y-1.5 pt-2 border-t border-border/50">
                              <div className="text-xs text-muted-foreground italic border-l-2 border-primary/50 pl-2 py-0.5">
                                <Quote className="w-3 h-3 inline mr-1" />
                                {replyingTo.content}
                              </div>
                              <div className="relative">
                                <textarea
                                  value={replyInput}
                                  onChange={(e) => setReplyInput(e.target.value)}
                                  placeholder={`${t('articles:writeReply')}...`}
                                  rows={2}
                                  className="w-full px-3 py-2 text-sm min-h-[50px] bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring/30"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      submitReply(comment.id);
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className="absolute bottom-1 right-1">
                                  <EmojiPicker
                                    onEmojiSelect={(emoji) => setReplyInput(prev => prev + emoji)}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-xs text-muted-foreground mr-auto">Shift+Enter for new line</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={cancelReply}
                                >
                                  {t('common:cancel')}
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-6 text-xs px-3"
                                  onClick={() => submitReply(comment.id)}
                                  disabled={!replyInput.trim()}
                                >
                                  {t('articles:reply')}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Replies to this comment - using recursive component */}
                          {expandedReplies.has(comment.id) && comment.replies && comment.replies.length > 0 && (
                            <div className="mt-1.5 space-y-1.5">
                              {comment.replies.map((reply) => (
                                <RecursiveReplyItem
                                  key={reply.id}
                                  reply={reply}
                                  user={user}
                                  startReply={startReply}
                                  replyingTo={replyingTo}
                                  replyInput={replyInput}
                                  setReplyInput={setReplyInput}
                                  submitReply={submitReply}
                                  cancelReply={cancelReply}
                                  toggleCommentReaction={toggleCommentReaction}
                                  expandedReplies={expandedReplies}
                                  toggleReplyExpansion={toggleReplyExpansion}
                                  depth={1} // First-level replies have depth 1
                                  t={t}
                                  i18n={i18n}
                                  ru={ru}
                                  enUS={enUS}
                                />
                                                        
                                                        
                              ))}
                            </div>
                          )}
                        

                                              
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">{t('articles:loadingArticle')}</p>
              </div>
            )
          ) : (
            // Articles List View
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">
                  {selectedCategory 
                    ? `${categories.find(c => c.slug === selectedCategory)?.title} (${totalArticles})`
                    : t('articles:allArticles')}
                </h2>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `${t('articles:found')}: ${totalArticles} ${t('articles:forSearch', { search: searchQuery })}`
                    : selectedCategory 
                      ? `${t('articles:showing')} ${totalArticles} ${t('articles:articlesInCategory')}`
                      : `${t('articles:found')}: ${totalArticles} ${t('articles:totalArticles')}`}
                </p>
              </div>
              
              {loading ? (
                <div className="flex flex-col gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : articles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">
                    {searchQuery || selectedCategory 
                      ? t('articles:noArticlesFound') 
                      : t('articles:noArticles')
                    }
                  </div>
                  {!searchQuery && !selectedCategory && (
                    <Button size="sm" className="h-9" asChild>
                      <Link href="/articles/new">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('articles:createFirstArticle')}
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {articles.map((article: Article) => {
                    return (
                      <div 
                        key={article.id} 
                        className="min-w-[666px] p-3 rounded-lg border border-gray-200 hover:bg-[#fbf2d0] hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
                        onClick={() => handleArticleSelect(article.id)}
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {article.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {article.author?.avatarUrl ? (
                                <img 
                                  src={article.author.avatarUrl} 
                                  alt={article.author.username}
                                  className="w-4 h-4 rounded-full"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                                  <span className="text-xs font-medium">
                                    {(article.author?.username || article.author?.fullName || "Reader").charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span>{article.author?.fullName || article.author?.username || "Reader"}</span>
                            </div>
                            {article.publishedAt && (
                              <span>•</span>
                            )}
                            {article.publishedAt && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(article.publishedAt)}</span>
                              </div>
                            )}
                          </div>
                          {article.excerpt && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {article.excerpt}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {(article.tags || []).slice(0, 2).map((tag) => (
                            <span key={tag.slug} className="text-xs bg-muted px-2 py-1 rounded">
                              {tag.name}
                            </span>
                          ))}
                          {article.section && (
                            <span className="text-xs bg-[#fee685] px-2 py-1 rounded">
                              {article.section ? t('articles:editor.sections.' + article.section) : article.section}
                            </span>
                          )}
                          {article.createdAt && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(article.createdAt)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            <span>{article.views}</span>
                          </div>
                          
                          {user && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleReadLater(article.id, article.isReadLater);
                                }}
                                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={article.isReadLater ? t('articles:removeFromReadLater') : t('articles:addToReadLater')}
                              >
                                <Bookmark 
                                  className={`h-3 w-3 ${article.isReadLater ? 'fill-current text-primary' : ''}`} 
                                  />
                              </button>
                              <span className="text-xs text-muted-foreground">
                                {article.bookmarkCount || 0}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      size="sm"
                      className="h-9"
                    >
                      Previous
                    </Button>
                    
                    <span className="px-4 py-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <Button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      size="sm"
                      className="h-9"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Favorites Section - Only show if user is logged in and has favorite articles */}
          {user && (selectedCategory !== 'favorites' && !selectedArticle && !searchQuery && articles.length > 0) && (
            <div className="mt-12 border-t pt-8">
              <h2 className="text-2xl font-bold mb-6">{t('articles:favorites')}</h2>
              
              {loading ? (
                <div className="flex flex-col gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-3 rounded-lg border border-gray-200 bg-accent">
                      <div className="animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4"></div>
                          <div className="h-4 bg-muted rounded w-1/2"></div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="h-4 w-16 bg-muted rounded"></div>
                          <div className="h-4 w-10 bg-muted rounded"></div>
                          <div className="h-4 w-4 bg-muted rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {articles.filter(article => article.isReadLater).length > 0 ? (
                    articles.filter(article => article.isReadLater).map((article: Article) => (
                      <div 
                        key={`favorite-${article.id}`} 
                        className="p-3 rounded-lg border border-gray-200 hover:bg-[#fbf2d0] hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
                        onClick={() => handleArticleSelect(article.id)}
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {article.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {article.author?.avatarUrl ? (
                                <img 
                                  src={article.author.avatarUrl} 
                                  alt={article.author.username}
                                  className="w-4 h-4 rounded-full"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                                  <span className="text-xs font-medium">
                                    {(article.author?.username || article.author?.fullName || "Reader").charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span>{article.author?.fullName || article.author?.username || "Reader"}</span>
                            </div>
                            {article.publishedAt && (
                              <span>•</span>
                            )}
                            {article.publishedAt && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(article.publishedAt)}</span>
                              </div>
                            )}
                          </div>
                          {article.excerpt && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {article.excerpt}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {(article.tags || []).slice(0, 2).map((tag) => (
                            <span key={tag.slug} className="text-xs bg-muted px-2 py-1 rounded">
                              {tag.name}
                            </span>
                          ))}
                          {article.section && (
                            <span className="text-xs bg-secondary px-2 py-1 rounded">
                              {article.section ? t('articles:editor.sections.' + article.section) : article.section}
                            </span>
                          )}
                          {article.createdAt && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(article.createdAt)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            <span>{article.views}</span>
                          </div>
                          
                          {user && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleReadLater(article.id, article.isReadLater);
                                }}
                                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={article.isReadLater ? t('articles:removeFromReadLater') : t('articles:addToReadLater')}
                              >
                                <Bookmark 
                                  className={`h-3 w-3 ${article.isReadLater ? 'fill-current text-primary' : ''}`} 
                                  />
                              </button>
                              <span className="text-xs text-muted-foreground">
                                {article.bookmarkCount || 0}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {t('articles:noArticlesFound')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}