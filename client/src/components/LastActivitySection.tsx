import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Newspaper, BookOpen, MessageCircle, Star, ChevronDown, ChevronUp, Trash2, User, Reply, Quote } from 'lucide-react';
import { formatDistanceToNow, format, differenceInHours } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { CommentItem } from './ProfileRatingsSection';
import { ReviewItem } from './ReviewsSection';
import { EmojiPicker } from './EmojiPicker';
import { UserNameWithRating } from './UserNameWithRating';

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
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
  reactions?: Reaction[];
  replyCount?: number;
  replies?: Comment[];
}

interface Review {
  id: string;
  bookId: string;
  author: string;
  username?: string;
  content: string;
  rating: number | null;
  userBookRating?: number | null;
  createdAt: string;
  reactions: Reaction[];
  userId: string;
  avatarUrl?: string | null;
  attachments?: any[];
  isOwnReview?: boolean;
  parentReviewId?: string | null;
  quotedText?: string | null;
  parentReviewAuthor?: string | null;
  replyCount?: number;
  replies?: Review[];
}

interface Activity {
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

interface LastAction {
  id: string;
  type: 'user_action';
  action_type: string;
  entityId: string;
  userId: string;
  user: {
    id?: string;
    username?: string;
    avatar_url?: string;
  };
  target?: {
    type?: string;
    id?: string;
    title?: string;
    username?: string;
    full_name?: string;
    name?: string;
    shelf_id?: string;
    shelf_name?: string;
  };
  metadata: any;
  createdAt: string | Date;
  timestamp: string;
}

type UserActivity = Activity | LastAction;

interface LastActivitySectionProps {
  profileId: string;
  profileUsername: string;
}

export function LastActivitySection({ profileId, profileUsername }: LastActivitySectionProps) {
  console.log('=== LastActivitySection RENDERED ===');
  const { t, i18n } = useTranslation(['profile', 'stream']);
  const { user } = useAuth();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [quotedText, setQuotedText] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  useEffect(() => {
    fetchUserActivities();
  }, [profileId]);

  const fetchUserActivities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/profile/${profileId}/activities`);
      
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      } else {
        console.error('Failed to fetch user activities');
      }
    } catch (error) {
      console.error('Error fetching user activities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handlers for CommentItem and ReviewItem
  const handleToggleReplies = async (commentId: string) => {
    console.log('=== handleToggleReplies CALLED ===');
    console.log('Comment ID:', commentId);
    console.log('Current expandedReplies:', Array.from(expandedReplies));
    
    if (expandedReplies.has(commentId)) {
      console.log('Closing replies for:', commentId);
      setExpandedReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        console.log('New expanded set:', Array.from(newSet));
        return newSet;
      });
    } else {
      console.log('Opening replies for:', commentId);
      // Check if we need to load replies data
      const activity = activities.find(a => a.id === commentId);
      console.log('Found activity:', activity?.id, activity?.type);
      
      if (activity && activity.type === 'comment') {
        console.log('Activity metadata:', activity.metadata);
        const replyCount = activity.metadata?.reply_count || 0;
        
        console.log('Reply count from metadata:', replyCount);
        
        // Always fetch replies regardless of count (temporary fix)
        console.log('Fetching replies from API (ignoring count)');
        await fetchReplies(commentId, activity.bookId || activity.metadata?.book_id);
      }
      setExpandedReplies(prev => {
        const newSet = new Set(prev).add(commentId);
        console.log('New expanded set:', Array.from(newSet));
        return newSet;
      });
    }
  };

  const fetchReplies = async (commentId: string, bookId?: string) => {
    console.log('=== fetchReplies CALLED ===');
    console.log('Comment ID:', commentId);
    console.log('Book ID:', bookId);
    
    try {
      if (!bookId) {
        console.error('No book ID provided');
        return;
      }
      
      // Load replies directly (they have full data)
      const response = await fetch(`/api/comments/${commentId}/replies`, {
        headers: user
          ? { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
          : {}
      });

      if (response && response.ok) {
        const replies = await response.json();
        console.log('Fetched replies:', replies);
        console.log('Reply count:', replies.length);
        
        // Update the activity with its replies
        setActivities(prev => {
          console.log('Updating activities state');
          const updated = updateActivityReplies(prev, commentId, replies);
          console.log('Updated activities:', updated);
          return updated;
        });
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
    }
  };

  const handleReply = (item: any) => {
    setReplyingToId(item.id);
    setQuotedText('');
  };

  const handleCancelReply = () => {
    setReplyingToId(null);
    setQuotedText('');
  };

  const handleReplyTextChange = (text: string) => {
    setReplyText(text);
  };

  const handleSubmitReply = async () => {
    if (!user || !replyText.trim() || !replyingToId) return;
    setSubmitting(true);
    
    try {
      const activity = activities.find(act => act.id === replyingToId);
      if (!activity) return;

      let response;
      if (activity.type === 'comment') {
        // Reply to comment
        const bookId = activity.bookId || activity.metadata?.book_id;
        if (!bookId) return;
        response = await fetch(`/api/books/${bookId}/comments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            content: replyText,
            quotedText: quotedText,
            parentCommentId: replyingToId
          })
        });
      } else if (activity.type === 'review') {
        // Reply to review
        const bookId = activity.bookId || activity.metadata?.book_id;
        if (!bookId) return;
        response = await fetch(`/api/books/${bookId}/reviews`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            content: replyText,
            quotedText: quotedText,
            parentReviewId: replyingToId
          })
        });
      }

      if (response && response.ok) {
        const data = await response.json();
        // Add the new reply to the activity
        setActivities(prev => addReplyToActivity(prev, replyingToId, data));
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setSubmitting(false);
      setReplyText('');
      setReplyingToId(null);
      setQuotedText('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    
    try {
      const activity = activities.find(act => act.id === id);
      if (!activity) return;

      let response;
      if (activity.type === 'comment') {
        response = await fetch(`/api/comments/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
      } else if (activity.type === 'review') {
        response = await fetch(`/api/reviews/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
      }

      if (response && response.ok) {
        // Remove the activity from the list
        setActivities(prev => prev.filter(activity => activity.id !== id));
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleReaction = async (id: string, emoji: string) => {
    if (!user) return;
    
    try {
      const activity = activities.find(act => act.id === id);
      if (!activity) return;

      let response;
      if (activity.type === 'comment') {
        response = await fetch(`/api/comments/${id}/reaction`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emoji })
        });
      } else if (activity.type === 'review') {
        response = await fetch(`/api/reviews/${id}/reaction`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emoji })
        });
      }

      if (response && response.ok) {
        const data = await response.json();
        // Update the activity with new reactions
        setActivities(prev => updateActivityReactions(prev, id, data.reactions));
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Helper function to update activity reactions
  const updateActivityReactions = (activities: UserActivity[], id: string, reactions: Reaction[]): UserActivity[] => {
    return activities.map(activity => {
      if (activity.id === id) {
        return {
          ...activity,
          metadata: {
            ...activity.metadata,
            reactions
          }
        };
      }
      return activity;
    });
  };

  // Helper function to update activity replies
  const updateActivityReplies = (prevActivities: UserActivity[], targetId: string, replies: any[]): UserActivity[] => {
    console.log('=== updateActivityReplies called ===');
    console.log('Target ID:', targetId);
    console.log('Replies to add:', replies);
    console.log('Previous activities count:', prevActivities.length);
    console.log('Call stack:', new Error().stack?.split('\n').slice(1, 4));
    
    // Track which activities we've already updated to prevent duplicates
    const updatedIds = new Set<string>();
    
    const updateRecursively = (activity: UserActivity): UserActivity => {
      // Prevent duplicate updates
      if (updatedIds.has(activity.id)) {
        return activity;
      }
      
      // If this is the target activity
      if (activity.id === targetId && activity.type === 'comment') {
        console.log('Found target activity, updating replies');
        console.log('Old reply count:', activity.metadata?.reply_count);
        
        // Merge new replies with existing ones (update incomplete data)
        const existingReplies = activity.metadata?.replies || [];
        const existingMap = new Map(existingReplies.map((r: any) => [r.id, r]));
        
        // Merge or add new replies
        const mergedReplies = [...existingReplies];
        
        for (const newReply of replies) {
          if (existingMap.has(newReply.id)) {
            // Update existing reply with new data (prefer complete data)
            const existingIndex = mergedReplies.findIndex(r => r.id === newReply.id);
            mergedReplies[existingIndex] = {
              ...mergedReplies[existingIndex],
              ...newReply  // Overwrite with new data
            };
          } else {
            // Add new reply
            mergedReplies.push(newReply);
          }
        }
        
        console.log('Merged replies count:', mergedReplies.length);
        
        console.log('New reply count:', mergedReplies.length);
        updatedIds.add(activity.id);
        
        return {
          ...activity,
          metadata: {
            ...activity.metadata,
            replies: mergedReplies,
            reply_count: mergedReplies.length
          }
        };
      }
      
      // If this activity has replies, check them recursively
      if (activity.type === 'comment' && activity.metadata?.replies) {
        const updatedReplies = activity.metadata.replies.map((reply: any) => {
          // If this reply is the target
          if (reply.id === targetId) {
            console.log('Found target reply, updating nested replies');
            updatedIds.add(reply.id);
            
            // Merge new replies with existing ones (update incomplete data)
            const existingReplies = reply.replies || [];
            const existingMap = new Map(existingReplies.map((r: any) => [r.id, r]));
            
            // Merge or add new replies
            const mergedReplies = [...existingReplies];
            
            for (const newReply of replies) {
              if (existingMap.has(newReply.id)) {
                // Update existing reply with new data
                const existingIndex = mergedReplies.findIndex(r => r.id === newReply.id);
                mergedReplies[existingIndex] = {
                  ...mergedReplies[existingIndex],
                  ...newReply
                };
              } else {
                // Add new reply
                mergedReplies.push(newReply);
              }
            }
            
            console.log('Merged nested replies count:', mergedReplies.length);
            
            return {
              ...reply,
              replies: mergedReplies,
              replyCount: mergedReplies.length
            };
          }
          
          // Recursively check nested replies
          if (reply.replies && reply.replies.length > 0) {
            return {
              ...reply,
              replies: reply.replies.map(updateRecursively)
            };
          }
          
          return reply;
        });
        
        return {
          ...activity,
          metadata: {
            ...activity.metadata,
            replies: updatedReplies
          }
        };
      }
      
      return activity;
    };
    
    const result = prevActivities.map(updateRecursively);
    console.log('Updated activities count:', result.length);
    return result;
  };

  // Helper function to add a reply to an activity
  const addReplyToActivity = (activities: UserActivity[], id: string, newReply: any): UserActivity[] => {
    return activities.map(activity => {
      if (activity.id === id) {
        const existingReplies = activity.metadata?.replies || [];
        return {
          ...activity,
          metadata: {
            ...activity.metadata,
            replyCount: (activity.metadata?.replyCount || 0) + 1,
            replies: [...existingReplies, newReply]
          }
        };
      }
      return activity;
    });
  };

  const handleTextSelect = useCallback((item: any) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      if (selectedText.length > 0 && selectedText.length <= 500) {
        setReplyingToId(item.id);
        setQuotedText(selectedText);
      }
    }
  }, []);

  const handleScrollTo = useCallback((id: string) => {
    const element = document.getElementById(`comment-${id}`) || document.getElementById(`review-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      setTimeout(() => {
        setHighlightedId(null);
      }, 2000);
    }
  }, []);

  const getRatingBadgeVariant = (rating: number | null) => {
    if (!rating) return 'secondary';
    if (rating >= 8) return 'default';
    if (rating >= 5) return 'secondary';
    return 'destructive';
  };

  const getRatingColor = (rating: number | null | undefined) => {
    if (!rating) return 'bg-muted text-muted-foreground border-muted';
    if (rating >= 8) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (rating >= 5) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  };

  const onUpdateCommentReactions = useCallback((commentId: string, reactions: Reaction[]) => {
    // Update comment reactions - we need to implement this
    console.log('Updating comment reactions:', commentId, reactions);
  }, []);

  const getActivityIcon = (activity: UserActivity) => {
    if (activity.type === 'user_action') {
      switch (activity.action_type) {
        case 'profile_comment':
        case 'profile_comment_reply':
          return <MessageCircle className="w-4 h-4 text-cyan-500" />;
        case 'profile_rating':
          return <Star className="w-4 h-4 text-yellow-500" />;
        default:
          return <MessageCircle className="w-4 h-4 text-gray-500" />;
      }
    }

    switch (activity.type) {
      case 'news':
        return <Newspaper className="w-4 h-4 text-blue-500" />;
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
    return {
      id: activity.id,
      userId: activity.userId,
      profileId: profileId,
      content: activity.metadata.content || activity.metadata.content_preview,
      createdAt: activity.createdAt,
      username: activity.metadata.author_name,
      fullName: activity.metadata.author_name,
      avatarUrl: activity.metadata.author_avatar,
      rating: null,
      isOwnComment: user?.id === activity.userId,
      parentCommentId: null,
      quotedText: null,
      parentCommentAuthor: null,
      reactions: activity.metadata.reactions,
      replyCount: activity.metadata.replyCount || activity.metadata.reply_count,
      replies: activity.metadata.replies || []  // ← Берем replies из metadata
    };
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
      replyCount: activity.metadata.replyCount || activity.metadata.reply_count,
      replies: activity.metadata.replies || []
    };
  };

  const renderActivityContent = (activity: UserActivity) => {
    if (activity.type === 'user_action') {
      switch (activity.action_type) {
        case 'profile_comment':
        case 'profile_comment_reply':
          return (
            <div>
              {activity.metadata?.comment_preview && (
                <p className="text-sm text-muted-foreground italic mb-2">
                  "{activity.metadata.comment_preview}"
                </p>
              )}
            </div>
          );
        case 'profile_rating':
          return (
            <div>
              {activity.metadata?.rating && (
                <p className="text-sm text-muted-foreground">
                  <Star className="w-3 h-3 inline-block text-yellow-500 mr-1" />
                  <span className="font-medium">{activity.metadata.rating}/10</span>
                </p>
              )}
            </div>
          );
        default:
          return null;
      }
    }

    const { metadata } = activity;

    switch (activity.type) {
      case 'news':
        return (
          <div>
            <Link href={`/news/${activity.entityId}`}>
              <h3 className="font-semibold text-sm hover:underline cursor-pointer mb-1">
                {metadata.title}
              </h3>
            </Link>
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
              <Link href={`/book/${activity.bookId}`}>
                <img 
                  src={metadata.cover_url} 
                  alt={metadata.title}
                  className="w-12 h-16 object-cover rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                />
              </Link>
            )}
            <div className="flex-1">
              <Link href={`/book/${activity.bookId}`}>
                <h3 className="font-semibold text-sm hover:underline cursor-pointer mb-1">
                  {metadata.title}
                </h3>
              </Link>
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
        /* console.log('Rendering CommentItem with props:', {
          commentId: comment.id,
          hasOnToggleReplies: !!handleToggleReplies,
          onToggleRepliesType: typeof handleToggleReplies,
          replyCount: comment.replyCount,
          repliesLength: comment.replies?.length || 0,
          hasReplies: !!comment.replies && comment.replies.length > 0
        }); */
        return (
          <div key={`comment-${comment.id}-${comment.replies?.length || 0}`} id={`comment-${comment.id}`}>
            <CommentItem
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
              onToggleReplies={handleToggleReplies}
              onReply={(comment) => {
                console.log('Reply button clicked for comment:', comment.id);
                setReplyingToId(comment.id);
                setQuotedText('');
              }}
              onCancelReply={() => {
                console.log('Cancel reply');
                setReplyingToId(null);
                setReplyText('');
                setQuotedText('');
              }}
              onReplyTextChange={(text) => {
                setReplyText(text);
              }}
              onSubmitReply={async () => {
                console.log('Submit reply');
                console.log('Validation check:', {
                  user: !!user,
                  replyText: replyText.trim(),
                  replyingToId: replyingToId,
                  hasAll: !!(user && replyText.trim() && replyingToId)
                });
                
                if (!user || !replyText.trim() || !replyingToId) {
                  console.log('Validation failed');
                  return;
                }
                
                setSubmitting(true);
                try {
                  // Find the activity recursively (including nested replies)
                  const findActivityRecursively = (activitiesList: UserActivity[]): Activity | undefined => {
                    for (const activity of activitiesList) {
                      if (activity.id === replyingToId && activity.type !== 'user_action') {
                        return activity as Activity;
                      }
                      
                      // Check nested replies
                      const metadata = (activity as Activity).metadata;
                      if (metadata?.replies) {
                        // Recursively search in replies
                        const foundInReplies = findActivityInReplies(metadata.replies, replyingToId);
                        if (foundInReplies) {
                          // Merge with activity data to get bookId
                          const typedActivity = activity as Activity;
                          return {
                            ...foundInReplies,
                            bookId: typedActivity.bookId || metadata.book_id || foundInReplies.bookId,
                            metadata: {
                              ...metadata,
                              ...foundInReplies.metadata,
                              book_id: typedActivity.bookId || metadata.book_id || foundInReplies.metadata?.book_id
                            }
                          } as Activity;
                        }
                      }
                    }
                    return undefined;
                  };
                  
                  const findActivityInReplies = (replies: any[], targetId: string): Activity | undefined => {
                    for (const reply of replies) {
                      if (reply.id === targetId) {
                        // Create fake activity from reply data
                        return {
                          id: reply.id,
                          type: 'comment',
                          entityId: reply.id,
                          userId: reply.userId,
                          bookId: reply.bookId,
                          metadata: {
                            book_id: reply.bookId,
                            ...reply
                          },
                          createdAt: reply.createdAt,
                          updatedAt: reply.updatedAt
                        } as Activity;
                      }
                      
                      if (reply.replies && reply.replies.length > 0) {
                        const found = findActivityInReplies(reply.replies, targetId);
                        if (found) return found;
                      }
                    }
                    return undefined;
                  };
                  
                  const activity = findActivityRecursively(activities);
                  const bookId = activity?.bookId || activity?.metadata?.book_id;
                  
                  console.log('Activity lookup:', {
                    activityId: replyingToId,
                    foundActivity: !!activity,
                    bookId: bookId
                  });
                  
                  if (!bookId) {
                    console.error('No book ID found');
                    return;
                  }
                  
                  const response = await fetch(`/api/books/${bookId}/comments`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({
                      content: replyText,
                      parentCommentId: replyingToId,
                      quotedText: quotedText || null
                    })
                  });
                  
                  if (response.ok) {
                    const newReply = await response.json();
                    console.log('Reply created:', newReply);
                    
                    // Ensure the new reply has proper user info for styling
                    const enrichedReply = {
                      ...newReply,
                      userId: user?.id, // Ensure userId is set for isOwnComment check
                      isOwnComment: true // Explicitly mark as own comment
                    };
                    
                    // Add reply to the correct nested location
                    setActivities(prev => {
                      console.log('=== Updating activities for new reply ===');
                      console.log('Replying to ID:', replyingToId);
                      console.log('New reply ID:', newReply.id);
                      
                      // First, let's see what activities we have and where replyingToId might be
                      prev.forEach(activity => {
                        if (activity.type === 'comment') {
                          console.log('Activity:', activity.id, 'has replies:', activity.metadata?.replies?.length || 0);
                          if (activity.metadata?.replies) {
                            activity.metadata.replies.forEach((reply: any) => {
                              console.log('  Reply:', reply.id, 'has nested replies:', reply.replies?.length || 0);
                              if (reply.id === replyingToId) {
                                console.log('!!! Found replyingToId in replies of activity:', activity.id);
                              }
                              // Also check nested replies
                              if (reply.replies) {
                                reply.replies.forEach((nestedReply: any) => {
                                  console.log('    Nested reply:', nestedReply.id);
                                  if (nestedReply.id === replyingToId) {
                                    console.log('!!!! Found replyingToId in NESTED replies of reply:', reply.id);
                                  }
                                });
                              }
                            });
                          }
                        }
                      });
                      
                      const updateRecursively = (activity: UserActivity): UserActivity => {
                        if (activity.type !== 'comment') return activity;
                        
                        // Check if this is the direct parent (separate activity)
                        if (activity.id === replyingToId) {
                          console.log('Found direct parent activity:', activity.id);
                          const existingReplies = activity.metadata?.replies || [];
                          console.log('Old direct replies count:', existingReplies.length);
                          const newReplies = [...existingReplies, enrichedReply];
                          console.log('New direct replies count:', newReplies.length);
                          return {
                            ...activity,
                            metadata: {
                              ...activity.metadata,
                              replies: newReplies,
                              reply_count: newReplies.length
                            }
                          };
                        }
                        
                        // Check if replyingToId is a child of this activity (recursive search)
                        if (activity.metadata?.replies) {
                          const updateRepliesRecursively = (replies: any[]): [any[], boolean] => {
                            let wasUpdated = false;
                            const updatedReplies = replies.map((reply: any) => {
                              if (reply.id === replyingToId) {
                                console.log('Found nested parent reply:', reply.id);
                                console.log('Old reply replies count:', reply.replies?.length || 0);
                                const newReplies = [...(reply.replies || []), enrichedReply];
                                console.log('New reply replies count:', newReplies.length);
                                wasUpdated = true;
                                return {
                                  ...reply,
                                  replies: newReplies,
                                  replyCount: newReplies.length
                                };
                              }
                              
                              // Recursively check deeper levels
                              if (reply.replies && reply.replies.length > 0) {
                                const [updatedNested, nestedUpdated] = updateRepliesRecursively(reply.replies);
                                if (nestedUpdated) {
                                  wasUpdated = true;
                                  return {
                                    ...reply,
                                    replies: updatedNested
                                  };
                                }
                              }
                              
                              return reply;
                            });
                            
                            return [updatedReplies, wasUpdated];
                          };
                          
                          const [updatedReplies, wasUpdated] = updateRepliesRecursively(activity.metadata.replies);
                          
                          if (wasUpdated) {
                            console.log('Updated nested replies in activity:', activity.id);
                            return {
                              ...activity,
                              metadata: {
                                ...activity.metadata,
                                replies: updatedReplies
                              }
                            };
                          }
                        }
                        
                        return activity;
                      };
                      
                      const result = prev.map(updateRecursively);
                      console.log('Activities updated, count:', result.length);
                      return result;
                    });
                    
                    // Automatically expand the parent to show the new reply
                    setExpandedReplies(prev => new Set(prev).add(replyingToId));
                    
                    // Reset form
                    setReplyingToId(null);
                    setReplyText('');
                    setQuotedText('');
                  }
                } catch (error) {
                  console.error('Error submitting reply:', error);
                } finally {
                  setSubmitting(false);
                }
              }}
              onDelete={() => {}}
              onReaction={() => {}}
              onTextSelect={() => {}}
              onScrollToComment={() => {}}
              getRatingBadgeVariant={() => 'secondary'}
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
              onToggleReplies={handleToggleReplies}
              onReply={(comment) => {
                console.log('Reply button clicked for comment:', comment.id);
                setReplyingToId(comment.id);
                setQuotedText('');
              }}
              onCancelReply={() => {
                console.log('Cancel reply');
                setReplyingToId(null);
                setReplyText('');
                setQuotedText('');
              }}
              onReplyTextChange={(text) => {
                setReplyText(text);
              }}
              onSubmitReply={async () => {
                console.log('Submit reply');
                console.log('Validation check:', {
                  user: !!user,
                  replyText: replyText.trim(),
                  replyingToId: replyingToId,
                  hasAll: !!(user && replyText.trim() && replyingToId)
                });
                
                if (!user || !replyText.trim() || !replyingToId) {
                  console.log('Validation failed');
                  return;
                }
                
                setSubmitting(true);
                try {
                  // Find the activity recursively (including nested replies)
                  const findActivityRecursively = (activitiesList: UserActivity[]): Activity | undefined => {
                    for (const activity of activitiesList) {
                      if (activity.id === replyingToId && activity.type !== 'user_action') {
                        return activity as Activity;
                      }
                      
                      // Check nested replies
                      const metadata = (activity as Activity).metadata;
                      if (metadata?.replies) {
                        // Recursively search in replies
                        const foundInReplies = findActivityInReplies(metadata.replies, replyingToId);
                        if (foundInReplies) {
                          // Merge with activity data to get bookId
                          const typedActivity = activity as Activity;
                          return {
                            ...foundInReplies,
                            bookId: typedActivity.bookId || metadata.book_id || foundInReplies.bookId,
                            metadata: {
                              ...metadata,
                              ...foundInReplies.metadata,
                              book_id: typedActivity.bookId || metadata.book_id || foundInReplies.metadata?.book_id
                            }
                          } as Activity;
                        }
                      }
                    }
                    return undefined;
                  };
                  
                  const findActivityInReplies = (replies: any[], targetId: string): Activity | undefined => {
                    for (const reply of replies) {
                      if (reply.id === targetId) {
                        // Create fake activity from reply data
                        return {
                          id: reply.id,
                          type: 'comment',
                          entityId: reply.id,
                          userId: reply.userId,
                          bookId: reply.bookId,
                          metadata: {
                            book_id: reply.bookId,
                            ...reply
                          },
                          createdAt: reply.createdAt,
                          updatedAt: reply.updatedAt
                        } as Activity;
                      }
                      
                      if (reply.replies && reply.replies.length > 0) {
                        const found = findActivityInReplies(reply.replies, targetId);
                        if (found) return found;
                      }
                    }
                    return undefined;
                  };
                  
                  const activity = findActivityRecursively(activities);
                  const bookId = activity?.bookId || activity?.metadata?.book_id;
                  
                  console.log('Activity lookup:', {
                    activityId: replyingToId,
                    foundActivity: !!activity,
                    bookId: bookId
                  });
                  
                  if (!bookId) {
                    console.error('No book ID found');
                    return;
                  }
                  
                  const response = await fetch(`/api/books/${bookId}/comments`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({
                      content: replyText,
                      parentCommentId: replyingToId,
                      quotedText: quotedText || null
                    })
                  });
                  
                  if (response.ok) {
                    const newReply = await response.json();
                    console.log('Reply created:', newReply);
                    
                    // Ensure the new reply has proper user info for styling
                    const enrichedReply = {
                      ...newReply,
                      userId: user?.id, // Ensure userId is set for isOwnComment check
                      isOwnComment: true // Explicitly mark as own comment
                    };
                    
                    // Add reply to the correct nested location
                    setActivities(prev => {
                      console.log('=== Updating activities for new reply ===');
                      console.log('Replying to ID:', replyingToId);
                      console.log('New reply ID:', newReply.id);
                      
                      // First, let's see what activities we have and where replyingToId might be
                      prev.forEach(activity => {
                        if (activity.type === 'comment') {
                          console.log('Activity:', activity.id, 'has replies:', activity.metadata?.replies?.length || 0);
                          if (activity.metadata?.replies) {
                            activity.metadata.replies.forEach((reply: any) => {
                              console.log('  Reply:', reply.id, 'has nested replies:', reply.replies?.length || 0);
                              if (reply.id === replyingToId) {
                                console.log('!!! Found replyingToId in replies of activity:', activity.id);
                              }
                              // Also check nested replies
                              if (reply.replies) {
                                reply.replies.forEach((nestedReply: any) => {
                                  console.log('    Nested reply:', nestedReply.id);
                                  if (nestedReply.id === replyingToId) {
                                    console.log('!!!! Found replyingToId in NESTED replies of reply:', reply.id);
                                  }
                                });
                              }
                            });
                          }
                        }
                      });
                      
                      const updateRecursively = (activity: UserActivity): UserActivity => {
                        if (activity.type !== 'comment') return activity;
                        
                        // Check if this is the direct parent (separate activity)
                        if (activity.id === replyingToId) {
                          console.log('Found direct parent activity:', activity.id);
                          const existingReplies = activity.metadata?.replies || [];
                          console.log('Old direct replies count:', existingReplies.length);
                          const newReplies = [...existingReplies, enrichedReply];
                          console.log('New direct replies count:', newReplies.length);
                          return {
                            ...activity,
                            metadata: {
                              ...activity.metadata,
                              replies: newReplies,
                              reply_count: newReplies.length
                            }
                          };
                        }
                        
                        // Check if replyingToId is a child of this activity (recursive search)
                        if (activity.metadata?.replies) {
                          const updateRepliesRecursively = (replies: any[]): [any[], boolean] => {
                            let wasUpdated = false;
                            const updatedReplies = replies.map((reply: any) => {
                              if (reply.id === replyingToId) {
                                console.log('Found nested parent reply:', reply.id);
                                console.log('Old reply replies count:', reply.replies?.length || 0);
                                const newReplies = [...(reply.replies || []), enrichedReply];
                                console.log('New reply replies count:', newReplies.length);
                                wasUpdated = true;
                                return {
                                  ...reply,
                                  replies: newReplies,
                                  replyCount: newReplies.length
                                };
                              }
                              
                              // Recursively check deeper levels
                              if (reply.replies && reply.replies.length > 0) {
                                const [updatedNested, nestedUpdated] = updateRepliesRecursively(reply.replies);
                                if (nestedUpdated) {
                                  wasUpdated = true;
                                  return {
                                    ...reply,
                                    replies: updatedNested
                                  };
                                }
                              }
                              
                              return reply;
                            });
                            
                            return [updatedReplies, wasUpdated];
                          };
                          
                          const [updatedReplies, wasUpdated] = updateRepliesRecursively(activity.metadata.replies);
                          
                          if (wasUpdated) {
                            console.log('Updated nested replies in activity:', activity.id);
                            return {
                              ...activity,
                              metadata: {
                                ...activity.metadata,
                                replies: updatedReplies
                              }
                            };
                          }
                        }
                        
                        return activity;
                      };
                      
                      const result = prev.map(updateRecursively);
                      console.log('Activities updated, count:', result.length);
                      return result;
                    });
                    
                    // Automatically expand the parent to show the new reply
                    setExpandedReplies(prev => new Set(prev).add(replyingToId));
                    
                    // Reset form
                    setReplyingToId(null);
                    setReplyText('');
                    setQuotedText('');
                  }
                } catch (error) {
                  console.error('Error submitting reply:', error);
                } finally {
                  setSubmitting(false);
                }
              }}
              onDelete={() => {}}
              onReaction={() => {}}
              onTextSelect={() => {}}
              onScrollToReview={() => {}}
              getRatingColor={() => '#6b7280'}
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
        onClick={() => {
          console.log('CardHeader clicked');
          setIsExpanded(!isExpanded);
        }}
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
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common:loading')}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('profile:noActivity')}
            </div>
          ) : (
            <div className="space-y-6">
              {activities.slice(0, 10).map((activity) => {
                // For comments and reviews, use the respective components
                if (activity.type === 'comment' || activity.type === 'review') {
                  return renderActivityContent(activity);
                }
                
                // For other activity types, use the default card view
                return (
                  <Card key={activity.id} className="hover:bg-card/80 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center gap-2">
                            {getActivityIcon(activity)}
                            <span className="text-sm font-medium">
                              {activity.type === 'user_action' 
                                ? t(`stream:actionTypes.${activity.action_type}`, activity.action_type)
                                : t(`stream:activityTypes.${activity.type}`)
                              }
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {formatDate('timestamp' in activity ? activity.timestamp || activity.createdAt : activity.createdAt)}
                        </div>
                      </div>
                      
                      {/* User info section - only for activities with user info */}
                      {activity.type === 'user_action' && activity.user?.username && (
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar className="w-8 h-8">
                            {activity.user.avatar_url && (
                              <AvatarImage
                                src={activity.user.avatar_url}
                                alt={activity.user.username}
                              />
                            )}
                            <AvatarFallback>
                              {(activity.user.username || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <Link href={`/profile/${activity.user.username || activity.user.id}`}>
                            <span className="text-sm font-medium hover:underline cursor-pointer">
                              {activity.user.username}
                            </span>
                          </Link>
                        </div>
                      )}
                      
                      {/* User info for regular activities */}
                      {activity.type !== 'user_action' && (activity.metadata?.author_name || activity.metadata?.uploader_name) && (
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar className="w-8 h-8">
                            {(activity.metadata.author_avatar || activity.metadata.uploader_avatar) && (
                              <AvatarImage 
                                src={activity.metadata.author_avatar || activity.metadata.uploader_avatar} 
                                alt={activity.metadata.author_name || activity.metadata.uploader_name} 
                              />
                            )}
                            <AvatarFallback>
                              {(activity.metadata.author_name || activity.metadata.uploader_name || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <UserNameWithRating
                            userId={activity.userId || ''}
                            username={activity.metadata.author_name || activity.metadata.uploader_name || ''}
                            fullName={activity.metadata.author_name || activity.metadata.uploader_name}
                            profileRating={null}
                            showRating={true}
                          />
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      {renderActivityContent(activity)}
                    </CardContent>
                  </Card>
                );
              })}
              
              {activities.length > 10 && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('profile:andMore', { count: activities.length - 10 })}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
