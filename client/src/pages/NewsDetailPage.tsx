import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ReactionBar } from '@/components/ReactionBar';
import { User, Eye, MessageCircle, Heart, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAbsoluteDateTime } from '@/lib/dateUtils';
import { ru, enUS } from 'date-fns/locale';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  avatarUrl?: string | null;
  publishedAt: string | null;
  createdAt: string;
  viewCount: number;
  commentCount: number;
  reactionCount: number;
}

interface Comment {
  id: string;
  userId: string;
  newsId: string;
  content: string;
  author: string;
  avatarUrl?: string | null;
  createdAt: string;
  reactions: {
    emoji: string;
    count: number;
    userReacted: boolean;
  }[];
}

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

const NewsDetailPage: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute('/news/:id');
  const id = params?.id;
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['common', 'news']);
  const dateLocale = i18n.language === 'ru' ? ru : enUS;
  const [newsItem, setNewsItem] = useState<NewsItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [isReacting, setIsReacting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchNewsDetails();
      fetchComments();
      fetchReactions();
    }
  }, [id]);

  const fetchNewsDetails = async () => {
    try {
      const response = await apiCall(`/api/news/${id}`, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setNewsItem(data);
    } catch (err: any) {
      console.error('Error fetching news details:', err);
      // Navigate back to news list if news item not found
      if (err.message?.includes('404')) {
        setLocation('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchReactions = async () => {
    if (!id) return;
    
    try {
      setReactionsLoading(true);
      const response = await apiCall(`/api/news/${id}/reactions`, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to fetch reactions: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setReactions(data);
    } catch (err: any) {
      console.error('Error fetching reactions:', err);
    } finally {
      setReactionsLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!id) return;
    
    try {
      setCommentsLoading(true);
      const response = await apiCall(`/api/news/${id}/comments`, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setComments(data);
    } catch (err: any) {
      console.error('Error fetching comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !user || !id) return;

    try {
      const response = await apiCall(`/api/news/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newComment }),
      });

      if (response.ok) {
        const newCommentObj = await response.json();
        
        // Format the comment to match our frontend interface and ensure user info is present
        const formattedComment = {
          ...newCommentObj,
          author: newCommentObj.author || user.fullName || user.username || 'Вы',
          avatarUrl: newCommentObj.avatarUrl || user.avatarUrl || null
        };
        
        // Add the new comment to the list
        setComments([formattedComment, ...comments]);
        setNewComment('');
        
        // Update the news item comment count
        if (newsItem) {
          setNewsItem({
            ...newsItem,
            commentCount: newsItem.commentCount + 1
          });
        }
      } else {
        console.error('Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!user || !id || isReacting) return;
    
    setIsReacting(true);
    
    try {
      const response = await apiCall(`/api/news/${id}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update the news item reaction count
        if (newsItem) {
          if (result.action === 'added') {
            setNewsItem({
              ...newsItem,
              reactionCount: newsItem.reactionCount + 1
            });
            
            // Update local reactions state
            setReactions(prev => {
              const existingReaction = prev.find(r => r.emoji === emoji);
              if (existingReaction) {
                return prev.map(r => 
                  r.emoji === emoji 
                    ? { ...r, count: r.count + 1, userReacted: true } 
                    : r
                );
              } else {
                return [...prev, { emoji, count: 1, userReacted: true }];
              }
            });
          } else {
            setNewsItem({
              ...newsItem,
              reactionCount: Math.max(0, newsItem.reactionCount - 1)
            });
            
            // Update local reactions state
            setReactions(prev => {
              return prev.map(r => 
                r.emoji === emoji 
                  ? { ...r, count: Math.max(0, r.count - 1), userReacted: false } 
                  : r
              );
            });
          }
        }
      } else {
        console.error('Failed to react to news');
      }
    } catch (error) {
      console.error('Error reacting to news:', error);
    } finally {
      setIsReacting(false);
    }
  };

  const handleCommentReact = async (commentId: string, emoji: string) => {
    if (!user || !id || isReacting) return;
    
    setIsReacting(true);
    
    try {
      // Call the API to add/remove reaction
      const response = await apiCall(`/api/news/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update the specific comment's reactions in the local state
        setComments(prevComments => {
          return prevComments.map(comment => {
            if (comment.id === commentId) {
              const existingReactionIndex = (comment.reactions || []).findIndex(r => r.emoji === emoji);
              let updatedReactions = [...(comment.reactions || [])];
              
              if (existingReactionIndex >= 0) {
                // Update existing reaction
                if (result.action === 'added') {
                  updatedReactions[existingReactionIndex] = {
                    ...updatedReactions[existingReactionIndex],
                    count: updatedReactions[existingReactionIndex].count + 1,
                    userReacted: true
                  };
                } else {
                  // Remove reaction if count becomes 0
                  if (updatedReactions[existingReactionIndex].count <= 1) {
                    updatedReactions.splice(existingReactionIndex, 1);
                  } else {
                    updatedReactions[existingReactionIndex] = {
                      ...updatedReactions[existingReactionIndex],
                      count: updatedReactions[existingReactionIndex].count - 1,
                      userReacted: false
                    };
                  }
                }
              } else if (result.action === 'added') {
                // Add new reaction
                updatedReactions.push({
                  emoji,
                  count: 1,
                  userReacted: true
                });
              }
              
              return {
                ...comment,
                reactions: updatedReactions || []
              };
            }
            return comment;
          });
        });
      } else {
        console.error('Failed to react to comment');
      }
    } catch (error) {
      console.error('Error reacting to comment:', error);
    } finally {
      setIsReacting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    
    try {
      // Determine endpoint based on user access level
      const isAdminOrModerator = user.accessLevel === 'admin' || user.accessLevel === 'moder';
      const endpoint = isAdminOrModerator 
        ? `/api/admin/comments/${commentId}`
        : `/api/comments/${commentId}`;
      
      const response = await apiCall(endpoint, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove comment from local state
        const updatedComments = comments.filter(comment => comment.id !== commentId);
        setComments(updatedComments);
        
        // Update news item comment count to match actual comments array length
        // This ensures synchronization even if database had wrong count
        setNewsItem(prevNewsItem => {
          if (!prevNewsItem) return prevNewsItem;
          return {
            ...prevNewsItem,
            commentCount: updatedComments.length
          };
        });
      } else {
        console.error('Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!newsItem) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-red-500">News not found</h2>
          <Button onClick={() => setLocation('/')} className="mt-4">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => window.history.back()} className="mb-6">
          ← {t('common:back')}
        </Button>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl">{newsItem.title}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  {newsItem.avatarUrl ? (
                    <AvatarImage src={newsItem.avatarUrl} alt={newsItem.author} />
                  ) : null}
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <Link 
                  href={`/profile/${newsItem.authorId}`}
                  target="_blank"
                  className="hover:underline text-blue-600 hover:text-blue-800"
                >
                  {newsItem.author}
                </Link>
              </div>
              <span>•</span>
              <span>{new Date(newsItem.createdAt).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {newsItem.viewCount} {t('common:views')}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {newsItem.commentCount} {t('common:comments')}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {newsItem.reactionCount} {t('common:reactions')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none dark:prose-invert">
              <p className="whitespace-pre-line text-lg">{newsItem.content}</p>
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <ReactionBar 
                reactions={reactions}
                onReact={handleReact}
              />
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">
            {t('common:comments')} ({comments.length})
          </h3>

          {/* Add Comment */}
          {user && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Avatar>
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                    ) : null}
                    <AvatarFallback>ВЫ</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      placeholder={t('common:writeComment')}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          // Only submit if validation passes (same as button disabled state)
                          if (newComment.trim()) {
                            handlePostComment();
                          }
                        }
                      }}
                      className="min-h-[100px]"
                    />
                    <div className="flex justify-end">
                      <Button onClick={handlePostComment} disabled={!newComment.trim()}>
                        {t('common:postComment')}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <div className="text-center py-4">
              <p>{t('common:loading')}...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('common:noCommentsYet')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map((comment) => (
                <Card key={comment.id} className="relative">
                  <CardContent className="pt-6">
                    {/* Delete Button */}
                    {user && (comment.userId === user.id || user.accessLevel === 'admin' || user.accessLevel === 'moder') && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="absolute top-4 right-4 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={t('common:deleteComment')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <div className="flex gap-4">
                      <Avatar>
                        {comment.avatarUrl ? (
                          <AvatarImage src={comment.avatarUrl} alt={comment.author} />
                        ) : null}
                        <AvatarFallback>{comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link 
                            href={`/profile/${comment.userId}`}
                            target="_blank"
                            className="font-medium hover:underline text-blue-600 hover:text-blue-800"
                          >
                            {comment.author || 'Anonymous'}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {formatAbsoluteDateTime(comment.createdAt, dateLocale)}
                          </span>
                        </div>
                        <p className="text-foreground/90 whitespace-pre-line">{comment.content}</p>
                        
                        <div className="mt-2">
                          <ReactionBar 
                            reactions={comment.reactions || []}
                            onReact={(emoji) => handleCommentReact(comment.id, emoji)}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsDetailPage;