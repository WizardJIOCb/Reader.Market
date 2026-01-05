import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NewsManagement from '@/components/NewsManagement';
import CommentsModeration from '@/components/CommentsModeration';
import ReviewsModeration from '@/components/ReviewsModeration';
import UserManagement from '@/pages/UserManagement';
import { 
  LayoutDashboard, 
  Newspaper, 
  MessageSquare, 
  Star,
  Users,
  LogOut 
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const AdminDashboard: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState({
    totalNews: 0,
    totalComments: 0,
    totalReviews: 0,
    newsChange: 0,
    commentsChange: 0,
    reviewsChange: 0,
  });
  const [accessChecked, setAccessChecked] = useState(false);
  interface ActivityItem {
    id: string;
    type: 'comment' | 'review';
    content: string;
    author: string;
    userId: string;
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
        console.log(`${activityType} updated successfully`);
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
          console.log(`${activity.type} deleted successfully`);
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
            newsResponse.json() as Promise<NewsItem[]>,
            commentsResponse.json() as Promise<CommentItem[]>,
            reviewsResponse.json() as Promise<ReviewItem[]>
          ]);
          
          setDashboardStats({
            totalNews: Array.isArray(newsData) ? newsData.length : 0,
            totalComments: Array.isArray(commentsData) ? commentsData.length : 0,
            totalReviews: Array.isArray(reviewsData) ? reviewsData.length : 0,
            newsChange: statsData.newsChange || 0,
            commentsChange: statsData.commentsChange || 0,
            reviewsChange: statsData.reviewsChange || 0,
          });
          
          // Fetch recent activity (comments and reviews)
          const activityResponse = await fetch('/api/admin/recent-activity', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (activityResponse.ok) {
            const activityData = await activityResponse.json();
            setRecentActivity(activityData);
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
  }, [activeTab]);

  // Check if access has been verified
  const isAdmin = user?.accessLevel === 'admin';
  const isModerator = user?.accessLevel === 'moder';
  const hasAccess = isAdmin || isModerator;

  if (!accessChecked) {
    // Still checking access
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Checking access...</h2>
          <p className="text-muted-foreground">Verifying your admin privileges</p>
        </div>
      </div>
    );
  }
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access the admin panel.
            </p>
            <Link href="/">
              <Button>Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'news', label: 'News Management', icon: Newspaper },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
    { id: 'reviews', label: 'Reviews', icon: Star },
    ...(isAdmin ? [{ id: 'users', label: 'User Management', icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Navigation */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user?.fullName || user?.username}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card min-h-screen">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Navigation</h2>
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

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && (
              <div>
                <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total News</CardTitle>
                      <Newspaper className="w-5 h-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {loadingStats ? (
                        <div className="text-2xl font-bold">Loading...</div>
                      ) : (
                        <div className="text-2xl font-bold">{dashboardStats.totalNews}</div>
                      )}
                      <p className="text-xs text-muted-foreground">+{dashboardStats.newsChange} from last month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Comments</CardTitle>
                      <MessageSquare className="w-5 h-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {loadingStats ? (
                        <div className="text-2xl font-bold">Loading...</div>
                      ) : (
                        <div className="text-2xl font-bold">{dashboardStats.totalComments}</div>
                      )}
                      <p className="text-xs text-muted-foreground">+{dashboardStats.commentsChange} new today</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Reviews</CardTitle>
                      <Star className="w-5 h-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {loadingStats ? (
                        <div className="text-2xl font-bold">Loading...</div>
                      ) : (
                        <div className="text-2xl font-bold">{dashboardStats.totalReviews}</div>
                      )}
                      <p className="text-xs text-muted-foreground">+{dashboardStats.reviewsChange} new today</p>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingActivity ? (
                      <p className="text-muted-foreground">Loading recent activity...</p>
                    ) : recentActivity.length > 0 ? (
                      <div className="space-y-4">
                        {recentActivity.map((activity) => (
                          <div key={activity.id} className="border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between">
                              <div>
                                <span className="font-medium">
                                  {activity.type === 'comment' ? 'Comment' : 'Review'}
                                </span>
                                <span className="text-muted-foreground ml-2">
                                  by <a 
                                    href={`/profile/${activity.userId}`}
                                    className="text-primary hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {activity.author}
                                  </a>
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(activity.createdAt).toLocaleString()}
                              </div>
                            </div>
                            {editingActivity && editingActivity.id === activity.id ? (
                              <div>
                                {activity.type === 'review' && (
                                  <div className="mb-2">
                                    <label className="block text-sm font-medium mb-1">Rating (1-10):</label>
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
                                    Save
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleCancelEdit}
                                  >
                                    Cancel
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
                                    <span className="ml-2">Rating: {activity.rating}/10</span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                  <div className="flex space-x-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleEditActivity(activity)}
                                    >
                                      Edit
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleDeleteActivity(activity)}
                                    >
                                      Delete
                                    </Button>
                                    <Button 
                                      variant="secondary" 
                                      size="sm" 
                                      onClick={() => window.open(`/book/${activity.bookId}`, '_blank', 'noopener,noreferrer')}
                                    >
                                      Show
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No recent activity to display.</p>
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

            {activeTab === 'users' && isAdmin && (
              <UserManagement />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;