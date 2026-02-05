import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '../components/ui/pagination';
import { useToast } from '../hooks/use-toast';
import { usePageView } from '../hooks/usePageView';
import { User, MessageSquare, BookMarked, MessageCircle, Star, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { UserCard } from '../components/UserCard';
import { formatAbsoluteDateTime } from '../lib/dateUtils';
import { ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';

interface PublicUser {
  id: number;
  username: string;
  fullName: string | null;
  avatar: string | null;
  profileRating: number | null;
  registeredAt: string;
  lastActivityAt: string | null;
  bio: string | null;
  isBlocked: boolean;
  commentsCount: number;
  reviewsCount: number;
  shelvesCount: number;
  booksCount: number;
}

interface UsersResponse {
  users: PublicUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const PublicUsers: React.FC = () => {
  const { i18n, t } = useTranslation(['users', 'navigation']);
  const { user } = useAuth();
  const dateLocale = i18n.language === 'ru' ? ru : enUS;
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Track page view for navigation logging
  usePageView('users');
  
  // Parse URL params helper
  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const savedLimit = localStorage.getItem('public_users_limit');
    const defaultLimit = savedLimit ? parseInt(savedLimit) : 9;
    
    return {
      search: params.get('search') || '',
      sortBy: params.get('sort') || 'rating',
      sortOrder: (params.get('order') as 'asc' | 'desc') || 'desc',
      page: parseInt(params.get('page') || '1'),
      limit: params.has('limit') ? parseInt(params.get('limit')!) : defaultLimit
    };
  };
  
  const initialParams = getUrlParams();
  
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialParams.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialParams.search);
  const [sortBy, setSortBy] = useState(initialParams.sortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialParams.sortOrder);
  const [itemsPerPage, setItemsPerPage] = useState(initialParams.limit);
  const [pagination, setPagination] = useState({
    page: initialParams.page,
    limit: initialParams.limit,
    total: 0,
    pages: 1
  });
  
  const lastFetchParams = React.useRef<string>('');
  const isFirstRender = React.useRef(true);

  // Debounce search input
  useEffect(() => {
    if (isFirstRender.current) {
      return; // Don't reset page on initial mount
    }
    
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: itemsPerPage.toString(),
        sortBy: sortBy,
        order: sortOrder,
      });

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      // Prevent duplicate requests
      const paramsString = params.toString();
      if (lastFetchParams.current === paramsString) {
        setLoading(false);
        return;
      }
      lastFetchParams.current = paramsString;

      const response = await fetch(`/api/public/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');

      const data: UsersResponse = await response.json();
      
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, itemsPerPage, sortBy, sortOrder, debouncedSearch, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  // Sync URL with state changes (after first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sortBy !== 'rating') params.set('sort', sortBy);
    if (sortOrder !== 'desc') params.set('order', sortOrder);
    if (pagination.page > 1) params.set('page', pagination.page.toString());
    if (itemsPerPage !== 9) params.set('limit', itemsPerPage.toString());
    
    const newUrl = `/users${params.toString() ? '?' + params.toString() : ''}`;
    const currentUrl = window.location.pathname + window.location.search;
    
    if (currentUrl !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [debouncedSearch, sortBy, sortOrder, pagination.page, itemsPerPage]);

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    const newLimit = parseInt(value);
    setItemsPerPage(newLimit);
    localStorage.setItem('public_users_limit', value);
    setPagination(prev => ({ ...prev, page: 1, limit: newLimit }));
  };

  // Handle sort change
  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle send message
  const handleSendMessage = (userId: number, username: string) => {
    if (!user) {
      toast({
        title: t('common:authRequired', 'Authentication required'),
        description: t('common:pleaseLogin', 'Please log in to send messages'),
        variant: 'destructive',
      });
      return;
    }
    
    // Navigate to messages with compose modal
    window.location.href = `/messages?user=${userId}`;
  };

  // Get rating badge color
  const getRatingColor = (rating: number | null) => {
    if (rating === null) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    if (rating >= 4) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (rating >= 2) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold mb-2">{t('title')}</h1>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">{t('sortOptions.rating')}</SelectItem>
              <SelectItem value="shelves">{t('sortOptions.shelves')}</SelectItem>
              <SelectItem value="books">{t('sortOptions.books')}</SelectItem>
              <SelectItem value="comments">{t('sortOptions.comments')}</SelectItem>
              <SelectItem value="reviews">{t('sortOptions.reviews')}</SelectItem>
              <SelectItem value="lastActivity">{t('sortOptions.lastActivity')}</SelectItem>
              <SelectItem value="registered">{t('sortOptions.registered')}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortOrder}
            className="border-input"
            aria-label={sortOrder === 'desc' ? 'Sort ascending' : 'Sort descending'}
            title={sortOrder === 'desc' ? 'Sort ascending' : 'Sort descending'}
          >
            {sortOrder === 'desc' ? (
              <ArrowDown className="h-4 w-4" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>

          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="6">6</SelectItem>
              <SelectItem value="9">9</SelectItem>
              <SelectItem value="12">12</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && users.length === 0 && (
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('noUsers')}</p>
        </div>
      )}

      {/* User Cards Grid */}
      {!loading && users.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                columns={2}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                    className={pagination.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  let pageNum;
                  if (pagination.pages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.pages - 2) {
                    pageNum = pagination.pages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => handlePageChange(pageNum)}
                        isActive={pagination.page === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(Math.min(pagination.pages, pagination.page + 1))}
                    className={pagination.page === pagination.pages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
};

export default PublicUsers;
