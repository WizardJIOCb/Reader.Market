import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import NewsManagement from '@/components/NewsManagement';
import CommentsModeration from '@/components/CommentsModeration';
import ReviewsModeration from '@/components/ReviewsModeration';
import UserManagement from '@/pages/UserManagement';
import BooksManagement from '@/components/BooksManagement';
import RatingSystemSettings from '@/pages/RatingSystemSettings';
import UserRatingSystemSettings from '@/pages/UserRatingSystemSettings';
import {
  LayoutDashboard, 
  Newspaper, 
  MessageSquare, 
  Star,
  Users,
  BookOpen,
  LogOut,
  User,
  Menu,
  ChevronLeft,
  ChevronRight,
  Settings,
  Activity
} from 'lucide-react';
import { AdminLoggingConfig } from './AdminLoggingConfig';
import { LogAnalytics } from './LogAnalytics';
import { useAuth } from '@/lib/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatAbsoluteDateTime } from '@/lib/dateUtils';
import { ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const AdminDashboard: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const isMobile = useIsMobile();
  const { i18n } = useTranslation();
  const { t } = useTranslation(['common', 'admin']);
  const dateLocale = i18n.language === 'ru' ? ru : enUS;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalNews: 0,
    totalComments: 0,
    totalReviews: 0,
    newsChange: 0,
    commentsChange: 0,
    reviewsChange: 0,
    userStats: {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
      year: 0
    }
  });
  const [accessChecked, setAccessChecked] = useState(false);
  interface ActivityItem {
    id: string;
    type: 'comment' | 'review';
    content: string;
    author: string;
    userId: string;
    avatarUrl?: string | null;
    createdAt: string;
    bookTitle: string;
    bookId: string;
    rating?: number;
  }
  
  interface EditingActivity {
    id: string;
    content: string;
    rating?: number;
  }
  
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [editingActivity, setEditingActivity] = useState<EditingActivity | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityPage, setActivityPage] = useState(() => {
    const saved = localStorage.getItem('admin_activity_page');
    return saved ? parseInt(saved) : 1;
  });
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityItemsPerPage, setActivityItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('admin_activity_limit');
    return saved ? parseInt(saved) : 20;
  });

  // Save pagination settings to localStorage
  useEffect(() => {
    localStorage.setItem('admin_activity_page', activityPage.toString());
  }, [activityPage]);

  useEffect(() => {
    localStorage.setItem('admin_activity_limit', activityItemsPerPage.toString());
  }, [activityItemsPerPage]);

  const handleEditActivity = (activity: ActivityItem) => {
    setEditingActivity({
      id: activity.id,
      content: activity.content,
      ...(activity.type === 'review' && activity.rating !== undefined ? { rating: activity.rating } : {})
    });
  };

  const handleSaveEdit = async (activityId: string) => {
    const activityToEdit = editingActivity;
    if (!activityToEdit || activityToEdit.id !== activityId) return;
    
    try {
      // Use the correct plural form for the API endpoint
      const activity = recentActivity.find(item => item.id === activityId);
      if (!activity) return;
      
      const endpointType = activity.type === 'comment' ? 'comments' : 'reviews';
      const activityType = activity.type;
      const response = await fetch(`/api/admin/${endpointType}/${activityId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editingActivity.content,
          ...(activity.type === 'review' && editingActivity.rating !== undefined ? { rating: editingActivity.rating } : {})
        })
      });
      
      if (response.ok) {
        // Update the activity in the list
        setRecentActivity(prev => 
          prev.map(item => 
            item.id === activityId 
              ? { 
                  ...item, 
                  content: editingActivity.content,
                  ...(item.type === 'review' && editingActivity.rating !== undefined ? { rating: editingActivity.rating } : {})
                }
              : item
          )
        );
        setEditingActivity(null);
      } else {
        console.error(`Failed to update ${activityType}:`, await response.text());
      }
    } catch (error) {
      const activity = recentActivity.find(item => item.id === activityId);
      const activityType = activity?.type || 'activity';
      console.error(`Error updating ${activityType}:`, error);
    }
  };

  const handleCancelEdit = () => {
    setEditingActivity(null);
  };

  const handleDeleteActivity = async (activity: ActivityItem) => {
    if (window.confirm(`Are you sure you want to delete this ${activity.type}?`)) {
      try {
        // Use the correct plural form for the API endpoint
        const endpointType = activity.type === 'comment' ? 'comments' : 'reviews';
        const response = await fetch(`/api/admin/${endpointType}/${activity.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (response.ok) {
          // Refresh the activity list
          setRecentActivity(prev => prev.filter(item => item.id !== activity.id));
        } else {
          const errorText = await response.text();
          console.error(`Failed to delete ${activity.type}:`, errorText);
          // Show error to user
          alert(`Failed to delete ${activity.type}: ${errorText}`);
        }
      } catch (error: unknown) {
        console.error(`Error deleting ${activity.type}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Error deleting ${activity.type}: ${errorMessage}`);
      }
    }
  };

  const handleLogout = () => {
    logout();
  };
  
  // Refresh user data on component mount to ensure we have the latest access level
  useEffect(() => {
    const refreshUserData = async () => {
      await refreshUser();
      setAccessChecked(true);
    };
    
    refreshUserData();
  }, []); // Empty dependency array to run only once on mount
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (activeTab === 'dashboard') {
        try {
          setLoadingStats(true);
          setLoadingActivity(true);
          
          // Define types for API responses
          interface NewsItem {
            id: string;
            title: string;
            content: string;
            author: string;
            published: boolean;
            createdAt: string;
            publishedAt: string | null;
          }
          
          interface CommentItem {
            id: string;
            content: string;
            author: string;
            userId: string;
            bookId: string;
            createdAt: string;
            updatedAt: string;
            bookTitle?: string;
          }
          
          interface ReviewItem {
            id: string;
            content: string;
            author: string;
            userId: string;
            rating: number;
            bookId: string;
            createdAt: string;
            updatedAt: string;
            bookTitle?: string;
          }
          
          // Fetch dashboard statistics
          const [newsResponse, commentsResponse, reviewsResponse] = await Promise.all([
            fetch('/api/admin/news', {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              }
            }),
            fetch('/api/admin/comments/pending', {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              }
            }),
            fetch('/api/admin/reviews/pending', {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              }
            })
          ]);
          
          // Fetch dashboard change statistics
          let statsData = {
            newsChange: 0,
            commentsChange: 0,
            reviewsChange: 0
          };
          
          try {
            const statsResponse = await fetch('/api/admin/dashboard-stats', {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              }
            });
            
            if (statsResponse.ok) {
              statsData = await statsResponse.json();
            }
          } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            // Use default values if the endpoint fails
            statsData = {
              newsChange: 0,
              commentsChange: 0,
              reviewsChange: 0
            };
          }
          
          const [newsData, commentsData, reviewsData] = await Promise.all([
            newsResponse.json(),
            commentsResponse.json(),
            reviewsResponse.json()
          ]);
          
          // Handle paginated responses
          const newsItems = newsData.items || newsData;
          const commentsItems = commentsData.items || commentsData;
          const reviewsItems = reviewsData.items || reviewsData;
          
          setDashboardStats({
            totalNews: newsData.total || (Array.isArray(newsItems) ? newsItems.length : 0),
            totalComments: commentsData.total || (Array.isArray(commentsItems) ? commentsItems.length : 0),
            totalReviews: reviewsData.total || (Array.isArray(reviewsItems) ? reviewsItems.length : 0),
            newsChange: statsData.newsChange || 0,
            commentsChange: statsData.commentsChange || 0,
            reviewsChange: statsData.reviewsChange || 0,
            userStats: (statsData as any).userStats || {
              total: 0,
              today: 0,
              week: 0,
              month: 0,
              year: 0
            }
          });
          
          // Fetch recent activity (comments and reviews)
          const activityResponse = await fetch(`/api/admin/recent-activity?page=${activityPage}&limit=${activityItemsPerPage}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (activityResponse.ok) {
            const activityData = await activityResponse.json();
            const items = activityData.items || activityData;
            const total = activityData.total || (Array.isArray(activityData) ? activityData.length : 0);
            const totalPages = activityData.totalPages || Math.ceil(total / activityItemsPerPage);
            
            setRecentActivity(items);
            setActivityTotal(total);
            setActivityTotalPages(totalPages);
          } else {
            // Fallback: combine comments and reviews data
            const combinedActivity: ActivityItem[] = [
              ...commentsData.map((item: CommentItem) => ({
                id: item.id,
                type: 'comment' as 'comment',
                content: item.content,
                author: item.author,
                userId: (item as any).userId || 'unknown',
                createdAt: item.createdAt,
                bookTitle: 'Book ' + item.bookId.substring(0, 8), // Use book ID as placeholder
                bookId: item.bookId
              })),
              ...reviewsData.map((item: ReviewItem) => ({
                id: item.id,
                type: 'review' as 'review',
                content: item.content,
                author: item.author,
                userId: (item as any).userId || 'unknown',
                rating: item.rating,
                createdAt: item.createdAt,
                bookTitle: 'Book ' + item.bookId.substring(0, 8), // Use book ID as placeholder
                bookId: item.bookId
              }))
            ];
            
            // Sort by date, most recent first
            combinedActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            setRecentActivity(combinedActivity.slice(0, 10)); // Limit to 10 most recent
          }
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
        } finally {
          setLoadingStats(false);
          setLoadingActivity(false);
        }
      }
    };
    
    fetchDashboardData();
  }, [activeTab, activityPage, activityItemsPerPage]);

  // Check if access has been verified
  const isAdmin = user?.accessLevel === 'admin';
  const isModerator = user?.accessLevel === 'moder';
  const hasAccess = isAdmin || isModerator;

  if (!accessChecked) {
    // Still checking access
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{t('admin:dashboard.checkingAccess')}</h2>
          <p className="text-muted-foreground">{t('admin:dashboard.verifyingPrivileges')}</p>
        </div>
      </div>
    );
  }
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">{t('admin:dashboard.accessDenied')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('admin:dashboard.noPermission')}
            </p>
            <Link href="/">
              <Button>{t('admin:dashboard.goHome')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: t('admin:navigation.dashboard'), icon: LayoutDashboard },
    { id: 'news', label: t('admin:navigation.newsManagement'), icon: Newspaper },
    { id: 'comments', label: t('admin:navigation.comments'), icon: MessageSquare },
    { id: 'reviews', label: t('admin:navigation.reviews'), icon: Star },
    { id: 'books', label: t('admin:navigation.books'), icon: BookOpen },
    ...(isAdmin ? [{ id: 'users', label: t('admin:navigation.userManagement'), icon: Users }] : []),
    ...(isAdmin ? [{ id: 'rating-system', label: t('admin:navigation.bookRatingSystem'), icon: Settings }] : []),
    ...(isAdmin ? [{ id: 'user-rating-system', label: t('admin:navigation.userRatingSystem'), icon: Settings }] : []),
    ...(isAdmin ? [{ id: 'logging', label: t('admin:navigation.loggingConfiguration'), icon: Settings }] : []),
    ...(isAdmin ? [{ id: 'log-analytics', label: t('admin:navigation.logAnalytics'), icon: Activity }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Navigation */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {isMobile && (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64">
                    <SheetHeader>
                      <SheetTitle>{t('admin:navigation.title')}</SheetTitle>
                    </SheetHeader>
                    <nav className="mt-6">
                      <ul className="space-y-1">
                        {menuItems.map((item) => (
                          <li key={item.id}>
                            <Button
                              variant={activeTab === item.id ? 'secondary' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => {
                                setActiveTab(item.id);
                                setMobileMenuOpen(false);
                              }}
                            >
                              <item.icon className="w-4 h-4 mr-2" />
                              {item.label}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </SheetContent>
                </Sheet>
              )}
              <h1 className="text-xl font-bold">{t('admin:dashboard.title')}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {t('admin:dashboard.welcome')}, {user?.fullName || user?.username}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                {t('common:logout')}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar - Hidden on mobile */}
        {!isMobile && (
          <aside className="w-64 border-r bg-card min-h-screen">
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4">{t('admin:navigation.title')}</h2>
              <nav>
                <ul className="space-y-1">
                  {menuItems.map((item) => (
                    <li key={item.id}>
                      <Button
                        variant={activeTab === item.id ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => setActiveTab(item.id)}
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.label}
                      </Button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && (
              <div>
                <h1 className="text-3xl font-bold mb-6">{t('admin:dashboard.title')}</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t('admin:stats.totalNews')}</CardTitle>
                      <Newspaper className="w-5 h-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {loadingStats ? (
                        <div className="text-2xl font-bold">{t('common:loading')}</div>
                      ) : (
                        <div className="text-2xl font-bold">{dashboardStats.totalNews}</div>
                      )}
                      <p className="text-xs text-muted-foreground">+{dashboardStats.newsChange} {t('admin:stats.fromLastMonth')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t('admin:stats.comments')}</CardTitle>
                      <MessageSquare className="w-5 h-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {loadingStats ? (
                        <div className="text-2xl font-bold">{t('common:loading')}</div>
                      ) : (
                        <div className="text-2xl font-bold">{dashboardStats.totalComments}</div>
                      )}
                      <p className="text-xs text-muted-foreground">+{dashboardStats.commentsChange} {t('admin:stats.newToday')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t('admin:stats.reviews')}</CardTitle>
                      <Star className="w-5 h-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {loadingStats ? (
                        <div className="text-2xl font-bold">{t('common:loading')}</div>
                      ) : (
                        <div className="text-2xl font-bold">{dashboardStats.totalReviews}</div>
                      )}
                      <p className="text-xs text-muted-foreground">+{dashboardStats.reviewsChange} {t('admin:stats.newToday')}</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* User Registration Statistics */}
                <Card className="mb-8">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('admin:stats.userRegistrations')}</CardTitle>
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {loadingStats ? (
                      <div className="text-2xl font-bold">{t('common:loading')}</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('admin:stats.totalUsers')}</p>
                          <p className="text-2xl font-bold">{dashboardStats.userStats.total}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('admin:stats.todayRegistrations')}</p>
                          <p className="text-2xl font-bold">{dashboardStats.userStats.today}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('admin:stats.weekRegistrations')}</p>
                          <p className="text-2xl font-bold">{dashboardStats.userStats.week}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('admin:stats.monthRegistrations')}</p>
                          <p className="text-2xl font-bold">{dashboardStats.userStats.month}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('admin:stats.yearRegistrations')}</p>
                          <p className="text-2xl font-bold">{dashboardStats.userStats.year}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>{t('admin:activity.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingActivity ? (
                      <p className="text-muted-foreground">{t('common:loading')}</p>
                    ) : recentActivity.length > 0 ? (
                      <>
                        <div className="space-y-4">
                        {recentActivity.map((activity) => (
                          <div key={activity.id} className="border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div className="flex items-start gap-2">
                                <Avatar className="w-6 h-6 flex-shrink-0">
                                  {activity.avatarUrl ? (
                                    <AvatarImage src={activity.avatarUrl} alt={activity.author} />
                                  ) : null}
                                  <AvatarFallback>
                                    <User className="w-3 h-3" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="font-medium">
                                    {activity.type === 'comment' ? t('admin:activity.comment') : t('admin:activity.review')}
                                  </span>
                                  <span className="text-muted-foreground ml-2">
                                    {t('admin:activity.by')} <a 
                                      href={`/profile/${activity.userId}`}
                                      className="text-primary hover:underline"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {activity.author}
                                    </a>
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatAbsoluteDateTime(activity.createdAt, dateLocale)}
                              </div>
                            </div>
                            {editingActivity && editingActivity.id === activity.id ? (
                              <div>
                                {activity.type === 'review' && (
                                  <div className="mb-2">
                                    <label className="block text-sm font-medium mb-1">{t('admin:activity.rating')} (1-10):</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="10"
                                      value={editingActivity.rating || activity.rating || 0}
                                      onChange={(e) => setEditingActivity({
                                        ...editingActivity,
                                        rating: parseInt(e.target.value) || 0
                                      })}
                                      className="w-20 p-2 border rounded"
                                    />
                                  </div>
                                )}
                                <textarea
                                  value={editingActivity.content}
                                  onChange={(e) => setEditingActivity({
                                    ...editingActivity,
                                    content: e.target.value
                                  })}
                                  className="w-full p-2 border rounded mt-2"
                                  rows={3}
                                />
                                <div className="flex space-x-2 mt-2">
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    onClick={() => handleSaveEdit(activity.id)}
                                  >
                                    {t('admin:activity.save')}
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleCancelEdit}
                                  >
                                    {t('admin:activity.cancel')}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="mt-1 text-sm">
                                  {activity.content.substring(0, 100)}{activity.content.length > 100 ? '...' : ''}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  on <a 
                                    href={`/book/${activity.bookId}`}
                                    className="text-primary hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {activity.bookTitle}
                                  </a>
                                  {activity.type === 'review' && activity.rating && (
                                    <span className="ml-2">{t('admin:activity.rating')}: {activity.rating}/10</span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                  <div className="flex space-x-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleEditActivity(activity)}
                                    >
                                      {t('admin:activity.edit')}
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleDeleteActivity(activity)}
                                    >
                                      {t('admin:activity.delete')}
                                    </Button>
                                    <Button 
                                      variant="secondary" 
                                      size="sm" 
                                      onClick={() => window.open(`/book/${activity.bookId}`, '_blank', 'noopener,noreferrer')}
                                    >
                                      {t('admin:activity.show')}
                                    </Button>
                                  </div>
                                </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-muted-foreground">
                            {t('admin:activity.showing')} {((activityPage - 1) * activityItemsPerPage) + 1} {t('admin:activity.to')} {Math.min(activityPage * activityItemsPerPage, activityTotal)} {t('admin:activity.of')} {activityTotal}
                          </div>
                          <Select value={activityItemsPerPage.toString()} onValueChange={(value) => {
                            setActivityItemsPerPage(parseInt(value));
                            setActivityPage(1);
                          }}>
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 {t('admin:activity.perPage')}</SelectItem>
                              <SelectItem value="10">10 {t('admin:activity.perPage')}</SelectItem>
                              <SelectItem value="20">20 {t('admin:activity.perPage')}</SelectItem>
                              <SelectItem value="50">50 {t('admin:activity.perPage')}</SelectItem>
                              <SelectItem value="100">100 {t('admin:activity.perPage')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                            disabled={activityPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            {t('admin:activity.previous')}
                          </Button>
                          <div className="text-sm text-muted-foreground px-2">
                            {t('admin:activity.page')} {activityPage} {t('admin:activity.of')} {activityTotalPages}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActivityPage(prev => Math.min(activityTotalPages, prev + 1))}
                            disabled={activityPage === activityTotalPages}
                          >
                            {t('admin:activity.next')}
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                    ) : (
                      <p className="text-muted-foreground">{t('admin:activity.noActivity')}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'news' && (
              <NewsManagement />
            )}

            {activeTab === 'comments' && (
              <CommentsModeration />
            )}

            {activeTab === 'reviews' && (
              <ReviewsModeration />
            )}

            {activeTab === 'books' && (
              <BooksManagement />
            )}

            {activeTab === 'users' && isAdmin && (
              <UserManagement />
            )}

            {activeTab === 'rating-system' && isAdmin && (
              <RatingSystemSettings />
            )}

            {activeTab === 'user-rating-system' && isAdmin && (
              <UserRatingSystemSettings />
            )}
            
            {activeTab === 'logging' && isAdmin && (
              <AdminLoggingConfig />
            )}
            
            {activeTab === 'log-analytics' && isAdmin && (
              <LogAnalytics />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;