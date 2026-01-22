// Simple working version of LastActivitySection
// Restores basic functionality without complex auto-loading

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../lib/auth';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { MessageCircle, BookOpen, Star, ChevronDown, ChevronUp, Reply } from 'lucide-react';
import { CommentItem } from './ProfileRatingsSection';
import { ReviewItem } from './ProfileReviewsSection';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface UserActivity {
  id: string;
  type: 'news' | 'book' | 'comment' | 'review';
  entityId: string;
  userId: string;
  targetUserId?: string;
  newsId?: string;
  bookId?: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  userId: string;
  profileId: string;
  content: string;
  createdAt: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  rating: number | null;
  isOwnComment?: boolean;
  parentCommentId?: string | null;
  quotedText?: string | null;
  parentCommentAuthor?: string | null;
  reactions?: any[];
  replyCount?: number;
  replies?: Comment[];
}

interface Review {
  id: string;
  bookId: string;
  author: string;
  username: string;
  content: string;
  rating: number;
  userBookRating: number;
  createdAt: string;
  reactions: any[];
  userId: string;
  avatarUrl: string | null;
  attachments: any[];
  isOwnReview?: boolean;
  parentReviewId?: string | null;
  quotedText?: string | null;
  parentReviewAuthor?: string | null;
  replyCount?: number;
  replies?: Review[];
}

interface LastActivitySectionProps {
  profileId: string;
  isOwnProfile: boolean;
  highlightedId?: string | null;
}

type Activity = UserActivity | Comment | Review;

export function LastActivitySection({
  profileId,
  isOwnProfile,
  highlightedId = null
}: LastActivitySectionProps) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation(['profile', 'stream', 'common']);
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  // Reply states
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [quotedText, setQuotedText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  const getActivityIcon = (activity: UserActivity) => {
    switch (activity.type) {
      case 'news':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'book':
        return <BookOpen className="w-4 h-4 text-green-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-purple-500" />;
      case 'review':
        return <Star className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const transformActivityToComment = (activity: Activity): Comment => {
    const isUserActivity = 'metadata' in activity;
    
    if (isUserActivity) {
      const metadata = activity.metadata || {};
      return {
        id: activity.id,
        userId: activity.userId || metadata.author_id || '',
        profileId: profileId,
        content: metadata.content || metadata.content_preview || '',
        createdAt: activity.timestamp || activity.createdAt || new Date().toISOString(),
        username: metadata.author_name || metadata.username || 'Unknown',
        fullName: metadata.author_name || null,
        avatarUrl: metadata.author_avatar || null,
        rating: null,
        isOwnComment: false,
        parentCommentId: metadata.parent_comment_id || null,
        quotedText: metadata.quoted_text || null,
        parentCommentAuthor: metadata.parent_comment_author || null,
        reactions: [],
        replyCount: metadata.reply_count || 0,
        replies: metadata.replies || []
      };
    } else {
      return activity as Comment;
    }
  };

  const transformActivityToReview = (activity: Activity): Review => {
    return {
      id: activity.id,
      bookId: activity.bookId || activity.metadata.book_id,
      author: activity.metadata.author_name,
      username: activity.metadata.author_name,
      content: activity.metadata.content || activity.metadata.content_preview,
      rating: activity.metadata.rating,
      userBookRating: activity.metadata.rating,
      createdAt: activity.createdAt,
      reactions: activity.metadata.reactions,
      userId: activity.userId,
      avatarUrl: activity.metadata.author_avatar,
      attachments: [],
      isOwnReview: user?.id === activity.userId,
      parentReviewId: null,
      quotedText: null,
      parentReviewAuthor: null,
      replyCount: activity.metadata.replyCount,
      replies: []
    };
  };

  const renderActivityContent = (activity: UserActivity) => {
    const { metadata } = activity;

    switch (activity.type) {
      case 'news':
        return (
          <div>
            <h3 className="font-semibold text-sm hover:underline cursor-pointer mb-1">
              {metadata.title}
            </h3>
            {metadata.content_preview && (
              <p className="text-sm text-muted-foreground">
                {metadata.content_preview}
              </p>
            )}
          </div>
        );

      case 'book':
        return (
          <div className="flex gap-3">
            {metadata.cover_url && (
              <img 
                src={metadata.cover_url} 
                alt={metadata.title}
                className="w-12 h-16 object-cover rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-sm hover:underline cursor-pointer mb-1">
                {metadata.title}
              </h3>
              {metadata.author && (
                <p className="text-xs text-muted-foreground">
                  {t('stream:author')}: {metadata.author}
                </p>
              )}
            </div>
          </div>
        );

      case 'comment':
        const comment = transformActivityToComment(activity as Activity);
        return (
          <div key={`comment-${comment.id}`} id={`comment-${comment.id}`}>
            <CommentItem
              key={`comment-item-${comment.id}`}
              comment={comment}
              depth={0}
              user={user}
              dateLocale={dateLocale}
              t={t}
              expandedReplies={expandedReplies}
              loadingReplies={loadingReplies}
              highlightedCommentId={highlightedId}
              replyingToId={replyingToId}
              replyText={replyText}
              quotedText={quotedText}
              submitting={submitting}
              onToggleReplies={() => {}}
              onReply={() => {}}
              onCancelReply={() => {}}
              onReplyTextChange={() => {}}
              onSubmitReply={() => {}}
              onDelete={() => {}}
              onReaction={() => {}}
              onTextSelect={() => {}}
              onScrollToComment={() => {}}
              getRatingBadgeVariant={() => 'default'}
              onUpdateCommentReactions={() => {}}
            />
          </div>
        );

      case 'review':
        const review = transformActivityToReview(activity as Activity);
        return (
          <div key={`review-${review.id}`} id={`review-${review.id}`}>
            <ReviewItem
              review={review}
              depth={0}
              user={user}
              dateLocale={dateLocale}
              t={t}
              expandedReplies={expandedReplies}
              loadingReplies={loadingReplies}
              highlightedReviewId={highlightedId}
              replyingToId={replyingToId}
              replyText={replyText}
              quotedText={quotedText}
              submitting={submitting}
              onToggleReplies={() => {}}
              onReply={() => {}}
              onCancelReply={() => {}}
              onReplyTextChange={() => {}}
              onSubmitReply={() => {}}
              onDelete={() => {}}
              onReaction={() => {}}
              onTextSelect={() => {}}
              onScrollToReview={() => {}}
              getRatingColor={() => '#f59e0b'}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const formatDate = (dateValue: string | Date) => {
    const activityDate = new Date(dateValue);
    const isValidDate = !isNaN(activityDate.getTime());
    
    if (!isValidDate) {
      return <span className="text-xs text-muted-foreground">Invalid date</span>;
    }

    const hoursSinceCreated = differenceInHours(new Date(), activityDate);
    const showFullDate = hoursSinceCreated >= 24;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground cursor-help">
              {showFullDate 
                ? format(activityDate, 'dd.MM.yyyy HH:mm', { locale: dateLocale })
                : formatDistanceToNow(activityDate, { addSuffix: true, locale: dateLocale })
              }
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{format(activityDate, 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/user/${profileId}/activities`);
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [profileId]);

  if (loading) {
    return (
      <section className="mt-12 mb-8">
        <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          {t('profile:lastActivity')}
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">
            {t('common:loading')}
          </div>
        </div>
      </section>
    );
  }

  if (activities.length === 0) {
    return (
      <section className="mt-12 mb-8">
        <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          {t('profile:lastActivity')}
        </h2>
        <div className="bg-card border p-8 rounded-xl shadow-sm text-center">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {t('profile:noActivity')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">{t('profile:lastActivity')}</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({activities.length} {activities.length === 1 ? t('profile:activity') : t('profile:activities')})
            </span>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 pt-6">
          {activities.slice(0, 10).map((activity) => (
            <div key={activity.id}>
              {renderActivityContent(activity)}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}