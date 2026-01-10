import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Heart, MessageSquare } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { newsReactionsApi } from '@/lib/api';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  published: boolean;
  publishedAt: string;
  viewCount: number;
  commentCount: number;
  reactionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Reaction {
  id: string;
  userId: string;
  newsId: string;
  emoji: string;
  createdAt: string;
  userFullName?: string;
  userUsername?: string;
}

const NewsReactionsManagement: React.FC = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newReactionCount, setNewReactionCount] = useState<number>(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchNewsItems();
    }
  }, []);

  const fetchNewsItems = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/admin/news');
      const data = await response.json();
      
      setNewsItems(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching news items:', err);
      setError('Failed to load news items');
    } finally {
      setLoading(false);
    }
  };

  const fetchReactions = async (newsId: string) => {
    try {
      setReactionsLoading(true);
      const response = await newsReactionsApi.getNewsReactions(newsId);
      const data = await response.json();
      
      setReactions(data);
      setNewReactionCount(data.length); // Set to current count initially
    } catch (err) {
      console.error('Error fetching reactions:', err);
      setError('Failed to load reactions');
    } finally {
      setReactionsLoading(false);
    }
  };

  const handleNewsSelect = (newsItem: NewsItem) => {
    setSelectedNews(newsItem);
    fetchReactions(newsItem.id);
  };

  const handleReactionCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setNewReactionCount(value);
    }
  };

  const handleSaveReactionCount = async () => {
    if (!selectedNews) return;

    try {
      await newsReactionsApi.updateNewsReactionCount(selectedNews.id, newReactionCount);

      // Update the news item in the list
      setNewsItems(prevItems => 
        prevItems.map(item => 
          item.id === selectedNews.id 
            ? { ...item, reactionCount: newReactionCount } 
            : item
        )
      );

      // Update the selected news item
      if (selectedNews) {
        setSelectedNews({
          ...selectedNews,
          reactionCount: newReactionCount
        });
      }
      
      setError(null);
    } catch (err) {
      console.error('Error updating reaction count:', err);
      setError('Failed to update reaction count');
    }
  };

  const handleDeleteReaction = async (reactionId: string) => {
    if (!window.confirm('Are you sure you want to delete this reaction? This action cannot be undone.')) {
      return;
    }

    try {
      await newsReactionsApi.deleteReaction(reactionId);

      // Remove the reaction from the local state
      setReactions(prevReactions => 
        prevReactions.filter(reaction => reaction.id !== reactionId)
      );
      
      // Update the reaction count in the selected news
      if (selectedNews) {
        setSelectedNews({
          ...selectedNews,
          reactionCount: Math.max(0, selectedNews.reactionCount - 1)
        });
        
        // Also update in the news list
        setNewsItems(prevItems => 
          prevItems.map(item => 
            item.id === selectedNews.id 
              ? { ...item, reactionCount: Math.max(0, item.reactionCount - 1) } 
              : item
          )
        );
      }
      
      setError(null);
    } catch (err) {
      console.error('Error deleting reaction:', err);
      setError('Failed to delete reaction');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            Loading news items...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">News Reactions Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage reactions for news articles
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select News Article</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {newsItems.map((newsItem) => (
              <div
                key={newsItem.id}
                className={`border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors ${
                  selectedNews?.id === newsItem.id ? 'bg-accent border-primary' : ''
                }`}
                onClick={() => handleNewsSelect(newsItem)}
              >
                <h3 className="font-medium truncate">{newsItem.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Reactions: {newsItem.reactionCount}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedNews && (
        <Card>
          <CardHeader>
            <CardTitle>
              Reactions for: {selectedNews.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Total Reaction Count:</label>
                <Input
                  type="number"
                  min="0"
                  value={newReactionCount}
                  onChange={handleReactionCountChange}
                  className="w-32"
                />
                <Button onClick={handleSaveReactionCount}>
                  Update Count
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Current stored count: {selectedNews.reactionCount}
              </p>
            </div>

            {reactionsLoading ? (
              <p>Loading reactions...</p>
            ) : (
              <div className="space-y-4">
                <h4 className="font-medium">Individual Reactions:</h4>
                {reactions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {reactions.map((reaction) => (
                      <div 
                        key={reaction.id} 
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{reaction.emoji}</span>
                          <span>
                            {reaction.userFullName || reaction.userUsername || 'Unknown User'}
                          </span>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteReaction(reaction.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No reactions found for this news article.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-4 text-red-500">
            {error}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewsReactionsManagement;