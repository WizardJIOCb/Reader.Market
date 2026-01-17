import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../lib/auth';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Star, ChevronDown, ChevronUp, Trash2, User } from 'lucide-react';

interface ProfileRatingsSectionProps {
  profileId: string;
  profileUsername: string;
  isOwnProfile: boolean;
  averageRating: number | null;
  ratingCount: number;
  onRatingChange?: (newRating: number | null) => void;
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
}

export default function ProfileRatingsSection({
  profileId,
  profileUsername,
  isOwnProfile,
  averageRating,
  ratingCount,
  onRatingChange
}: ProfileRatingsSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { i18n, t } = useTranslation(['profile', 'common']);
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  const [isExpanded, setIsExpanded] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [userComment, setUserComment] = useState<string>('');
  const [hasUserRating, setHasUserRating] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [commentsPerPage, setCommentsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch comment count on mount for header display
  useEffect(() => {
    fetchCommentCount();
  }, [profileId]);

  // Fetch comments when expanded
  useEffect(() => {
    if (isExpanded && !loading) {
      fetchComments();
    }
  }, [isExpanded, currentPage, commentsPerPage]);

  // Fetch user's existing rating and comment
  useEffect(() => {
    if (user && !isOwnProfile) {
      fetchUserRatingAndComment();
    }
  }, [user, profileId]);

  const fetchCommentCount = async () => {
    try {
      const response = await fetch(
        `/api/profile/${profileId}/comments?limit=1&offset=0`,
        {
          headers: user
            ? { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            : {}
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTotalComments(data.total);
      }
    } catch (error) {
      console.error('Error fetching comment count:', error);
    }
  };

  const fetchUserRatingAndComment = async () => {
    if (!user) return;

    try {
      // Fetch user's rating
      const ratingsResponse = await fetch(`/api/profile/${profileId}/ratings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (ratingsResponse.ok) {
        const ratings = await ratingsResponse.json();
        const myRating = ratings.find((r: any) => r.userId === user.id);
        if (myRating) {
          setUserRating(myRating.rating);
          setHasUserRating(true);
        }
      }
    } catch (error) {
      console.error('Error fetching user rating:', error);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * commentsPerPage;
      const response = await fetch(
        `/api/profile/${profileId}/comments?limit=${commentsPerPage}&offset=${offset}`,
        {
          headers: user
            ? { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            : {}
        }
      );

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
        setTotalComments(data.total);
      } else {
        toast({
          title: t('profile:ratings.error'),
          description: t('profile:ratings.failedToLoadComments'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.failedToLoadComments'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!user || !userRating) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/profile/${profileId}/rating`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: userRating })
      });

      if (response.ok) {
        setHasUserRating(true);
        toast({
          title: t('profile:ratings.success'),
          description: hasUserRating ? t('profile:ratings.ratingUpdated') : t('profile:ratings.ratingSubmitted')
        });
        
        // Refresh ratings
        if (onRatingChange) {
          onRatingChange(userRating);
        }
        
        // Refresh comments to update rating badge
        if (isExpanded) {
          fetchComments();
        }
      } else {
        const error = await response.json();
        toast({
          title: t('profile:ratings.error'),
          description: error.error || t('profile:ratings.failedToSubmitRating'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.failedToSubmitRating'),
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !userComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/profile/${profileId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: userComment })
      });

      if (response.ok) {
        toast({
          title: t('profile:ratings.success'),
          description: t('profile:ratings.commentPosted')
        });
        
        // Clear comment input
        setUserComment('');
        
        // Refresh comments and count
        fetchComments();
        fetchCommentCount();
      } else {
        const error = await response.json();
        toast({
          title: t('profile:ratings.error'),
          description: error.error || t('profile:ratings.failedToPostComment'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.failedToPostComment'),
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(t('profile:ratings.deleteConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/profile/comment/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        toast({
          title: t('profile:ratings.success'),
          description: t('profile:ratings.commentDeleted')
        });
        
        // Refresh
        fetchComments();
        fetchCommentCount();
      } else {
        toast({
          title: t('profile:ratings.error'),
          description: t('profile:ratings.failedToDeleteComment'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: t('profile:ratings.error'),
        description: t('profile:ratings.failedToDeleteComment'),
        variant: 'destructive'
      });
    }
  };

  const totalPages = Math.ceil(totalComments / commentsPerPage);
  const isAuthenticated = !!user;
  const canComment = isAuthenticated;
  const canRate = isAuthenticated && !isOwnProfile;

  const getRatingBadgeVariant = (rating: number | null) => {
    if (!rating) return 'secondary';
    if (rating >= 8) return 'default';
    if (rating >= 5) return 'secondary';
    return 'destructive';
  };

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">{t('profile:ratings.title')}</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({totalComments} {totalComments === 1 ? t('profile:ratings.comment') : t('profile:ratings.comments')})
            </span>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Rating and Comment Input */}
          {isAuthenticated && (
            <div className="space-y-4 border-b pb-6">
              {/* Star Rating Input - only for other profiles */}
              {canRate && (
                <div className="space-y-2 mt-2">
                  <label className="text-sm font-medium">{t('profile:ratings.yourRating')}</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="transition-transform hover:scale-110"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setUserRating(star)}
                      >
                        <Star
                          className={`w-6 h-6 ${
                            (hoverRating !== null && star <= hoverRating) ||
                            (hoverRating === null && userRating !== null && star <= userRating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm font-medium">
                      {hoverRating || userRating || 0}/10
                    </span>
                  </div>
                  {userRating && (
                    <Button
                      onClick={handleSubmitRating}
                      disabled={submitting}
                      size="sm"
                    >
                      {hasUserRating ? t('profile:ratings.updateRating') : t('profile:ratings.submitRating')}
                    </Button>
                  )}
                </div>
              )}

              {/* Comment Input - available for all authenticated users */}
              {canComment && (
                <div className="space-y-2 mt-4">
                  <Textarea
                    placeholder={`${t('profile:ratings.yourComment')}...`}
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleSubmitComment}
                    disabled={submitting || !userComment.trim()}
                    size="sm"
                  >
                    {t('profile:ratings.postComment')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('profile:ratings.loadingComments')}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('profile:ratings.noComments')}
              </div>
            ) : (
              <>
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-4 rounded-lg border ${
                      comment.isOwnComment ? 'bg-accent/50 border-primary' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10">
                        {comment.avatarUrl ? (
                          <AvatarImage src={comment.avatarUrl} alt={comment.username} />
                        ) : null}
                        <AvatarFallback>
                          <User className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/profile/${comment.username}`}
                              className="font-medium hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {comment.fullName || comment.username}
                            </a>
                            {comment.rating && (
                              <Badge variant={getRatingBadgeVariant(comment.rating)} className="text-xs">
                                {comment.rating}/10
                              </Badge>
                            )}
                            {comment.isOwnComment && (
                              <Badge variant="outline" className="text-xs">
                                {t('profile:ratings.yourCommentBadge')}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', {
                                locale: dateLocale
                              })}
                            </span>
                            {(comment.isOwnComment || user?.accessLevel === 'admin' || user?.accessLevel === 'moder') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-2">
                      <Select
                        value={commentsPerPage.toString()}
                        onValueChange={(value) => {
                          setCommentsPerPage(parseInt(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 {t('profile:ratings.perPage')}</SelectItem>
                          <SelectItem value="10">10 {t('profile:ratings.perPage')}</SelectItem>
                          <SelectItem value="20">20 {t('profile:ratings.perPage')}</SelectItem>
                          <SelectItem value="50">50 {t('profile:ratings.perPage')}</SelectItem>
                          <SelectItem value="100">100 {t('profile:ratings.perPage')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        {t('profile:ratings.previous')}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        {t('profile:ratings.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
