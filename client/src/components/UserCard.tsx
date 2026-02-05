import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, MessageSquare, BookMarked, MessageCircle, Star } from 'lucide-react';
import { formatAbsoluteDateTime } from '@/lib/dateUtils';
import { ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface UserCardProps {
  user: {
    id: number | string;
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
  };
  variant?: 'compact' | 'detailed';
  columns?: number;
}

export function UserCard({ user, variant = 'compact', columns = 2 }: UserCardProps) {
  const { t, i18n } = useTranslation(['users', 'common']);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  // Handle send message
  const handleSendMessage = (userId: number | string, username: string) => {
    if (!currentUser) {
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

  return (
    <Card className="p-3 overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="flex flex-col gap-3">
        {/* Top Row: Avatar on left, Content on right */}
        <div className="flex gap-3">
          {/* Left: Avatar */}
          <Link href={`/profile/${user.username}`} className="flex-shrink-0">
            <div className="relative cursor-pointer">
              <Avatar className="h-28 w-28 rounded-lg object-cover shadow-sm">
                <AvatarImage src={user.avatar || undefined} alt={user.username} />
                <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-100 to-purple-100">
                  <User className="w-14 h-14 text-gray-400" />
                </AvatarFallback>
              </Avatar>
              
              {/* Rating badge */}
              {user.profileRating !== null && (
                <div className="absolute -top-1 -right-1 bg-yellow-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5 text-xs font-bold cursor-pointer">
                  <Star className="w-2 h-2 fill-current" />
                  {Number(user.profileRating) % 1 === 0 ? Number(user.profileRating) : Number(user.profileRating).toFixed(1)}
                </div>
              )}
            </div>
          </Link>
          
          {/* Right: Content (Username, Full Name, Bio) */}
          <div className="flex-1 min-w-0">
            <Link href={`/profile/${user.username}`}>
              <h3 className="font-serif font-bold text-base line-clamp-1">
                {user.fullName || user.username}
              </h3>
            </Link>
            <p className="text-muted-foreground font-bold text-xs line-clamp-1 mb-1">
              @{user.username}
            </p>
            
            <p className="text-[13px] text-muted-foreground mb-0 line-clamp-6">
              {user.bio || t('users:noBio', 'No bio')}
            </p>
          </div>
        </div>
        
        {/* Stats after the avatar and bio block */}
        <div className="flex flex-wrap gap-2 mb-2" style={{ minHeight: '24px' }}>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <BookMarked className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {user.shelvesCount} {t('stats.shelves')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <BookMarked className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {user.booksCount} {t('stats.books')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {user.commentsCount} {t('stats.comments')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {user.reviewsCount} {t('stats.reviews')}
              </span>
            </div>
          </div>
        </div>
        
        {/* Dates */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span className="font-medium">{t('registeredAt')}:</span>
            <span>{formatAbsoluteDateTime(user.registeredAt, dateLocale)}</span>
          </div>
          {user.lastActivityAt && (
            <div className="flex justify-between">
              <span className="font-medium">{t('lastActivity')}:</span>
              <span>{formatAbsoluteDateTime(user.lastActivityAt, dateLocale)}</span>
            </div>
          )}
        </div>
        
        {/* Quick Actions - at bottom */}
        <div className="flex gap-2">
          <Button asChild variant="outline" className="text-xs flex-1" size="sm"
            style={{ backgroundColor: '#ffe3af', border: '1px solid #979797' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffd995'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffe3af'}>
            <Link to={`/profile/${user.username}`} className="truncate">
              {t('actions.viewProfile')}
            </Link>
          </Button>
          <Button
            variant="outline"
            className="text-xs flex-1"
            size="sm"
            style={{ backgroundColor: '#ffedb2', border: '1px solid #979797' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffe499'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffedb2'}
            onClick={(e) => {
              e.preventDefault();
              handleSendMessage(user.id, user.username);
            }}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1 shrink-0" />
            <span>{t('actions.sendMessage')}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}