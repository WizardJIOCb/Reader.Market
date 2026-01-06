import React, { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { BookCard } from '@/components/BookCard';
import { LogoutButton } from '@/components/LogoutButton';
import { useAuth } from '@/lib/auth'; // Added import for auth context
import { 
  BookOpen, 
  Type, 
  AlignLeft, 
  MessageCircle, 
  Settings, 
  Share2, 
  ArrowLeft,
  Mail,
  MoreVertical,
  User,
  Camera,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  coverImageUrl?: string;
  description?: string;
  genre: string | string[]; // Required to match BookCard expectation
  publishedYear?: number;
  rating?: number;
  commentCount: number;
  reviewCount: number;
  lastActivityDate?: string;
  uploadedAt?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

interface ReadingProgress {
  bookId: string;
  percentage: number;
  wordsRead: number;
  lettersRead: number;
  lastReadAt: Date;
  currentPage: number;
  totalPages: number;
}

interface ProfileShelf {
  id: string;
  name: string;
  description?: string;
  color?: string;
  bookIds: string[];
  createdAt: string;
  updatedAt: string;
  books?: Book[];
}

interface UserProfile {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  stats: {
    booksRead: number;
    wordsRead: number;
    lettersRead: number;
  };
  shelves: (ProfileShelf & { books?: Book[] })[];
  recentlyReadIds: string[];
  readingProgress?: ReadingProgress[];
}

export default function Profile() {
  const [match, params] = useRoute('/profile/:userId');
  const { toast } = useToast();
  const { user: currentUser } = useAuth(); // Get current authenticated user
  const userId = params?.userId;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if viewing own profile
  const isOwnProfile = currentUser?.id === userId;

  const handleSendMessage = async () => {
    if (!profile) return;
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          recipientId: profile.id,
          content: message
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }
      
      toast({
        title: "Сообщение отправлено",
        description: `Ваше сообщение для ${profile.name} успешно отправлено.`,
      });
      setMessage('');
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : 'Не удалось отправить сообщение',
        variant: "destructive"
      });
    }
  };

  const handleEditProfile = () => {
    if (!profile) return;
    setIsEditing(true);
    setEditBio(profile.bio);
    setEditFullName(profile.name);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          bio: editBio,
          fullName: editFullName
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
      
      const updatedProfile = await response.json();
      setProfile({
        ...profile,
        bio: updatedProfile.bio || '',
        name: updatedProfile.fullName || updatedProfile.username
      });
      setIsEditing(false);
      toast({
        title: "Профиль обновлен",
        description: "Ваш профиль успешно обновлен."
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : 'Не удалось обновить профиль',
        variant: "destructive"
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (profile) {
      setEditBio(profile.bio);
      setEditFullName(profile.name);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, загрузите изображение в формате JPEG, PNG, GIF или WebP",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Ошибка",
        description: "Размер файла не должен превышать 5MB",
        variant: "destructive"
      });
      return;
    }

    try {
      setAvatarUploading(true);

      const formData = new FormData();
      formData.append('avatar', file);

      // Use direct backend URL in development to bypass Vite proxy for file uploads
      // Vite proxy doesn't handle multipart/form-data well
      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:5001/api/profile/avatar'
        : '/api/profile/avatar';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload avatar');
      }

      const updatedUser = await response.json();
      
      // Update profile with new avatar
      if (profile) {
        setProfile({
          ...profile,
          avatar: updatedUser.avatarUrl || ''
        });
      }

      toast({
        title: "Аватар обновлен",
        description: "Ваш аватар успешно загружен"
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : 'Не удалось загрузить аватар',
        variant: "destructive"
      });
    } finally {
      setAvatarUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAvatarDelete = async () => {
    if (!profile?.avatar) return;

    try {
      setAvatarUploading(true);

      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:5001/api/profile/avatar'
        : '/api/profile/avatar';

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete avatar');
      }

      // Update profile to remove avatar
      setProfile({
        ...profile,
        avatar: ''
      });

      toast({
        title: "Аватар удален",
        description: "Ваш аватар успешно удален"
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : 'Не удалось удалить аватар',
        variant: "destructive"
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    
    try {
      const profileUrl = `${window.location.origin}/profile/${profile.id}`;
      await navigator.clipboard.writeText(profileUrl);
      
      toast({
        title: "Ссылка скопирована",
        description: "Ссылка на профиль скопирована в буфер обмена"
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : 'Не удалось скопировать ссылку',
        variant: "destructive"
      });
    }
  };


  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/profile/${userId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        
        const userData = await response.json();
        
        // Format the user data to match the expected structure
        // Fetch user's shelves based on whether it's the current user or another user
        let shelves = [];
        if (isOwnProfile) {
          // Fetch current user's shelves
          const shelvesResponse = await fetch(`/api/shelves`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (shelvesResponse.ok) {
            shelves = await shelvesResponse.json();
          }
        } else {
          // Fetch other user's shelves
          const userShelvesResponse = await fetch(`/api/shelves/user/${userId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (userShelvesResponse.ok) {
            shelves = await userShelvesResponse.json();
          }
        }
        
        // Fetch books for each shelf
        const shelvesWithBooks = await Promise.all(
          shelves.map(async (shelf: ProfileShelf) => {
            if (shelf.bookIds && shelf.bookIds.length > 0) {
              try {
                const booksResponse = await fetch('/api/books/by-ids', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                  },
                  body: JSON.stringify({ bookIds: shelf.bookIds })
                });
                
                if (booksResponse.ok) {
                  const books = await booksResponse.json();
                  // Ensure books have proper genre field to match BookCard expectations
                  const formattedBooks = books.map((book: any) => ({
                    ...book,
                    genre: book.genre !== undefined ? book.genre : ''
                  }));
                  return {
                    ...shelf,
                    books: formattedBooks
                  };
                }
              } catch (error) {
                console.error('Error fetching books for shelf:', error);
              }
            }
            return {
              ...shelf,
              books: []
            };
          })
        );
        
        // Fetch user's reading statistics
        let userStats = {
          booksRead: 0,
          wordsRead: 0,
          lettersRead: 0
        };
        
        try {
          const statsResponse = await fetch(`/api/users/${userData.id}/statistics`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            userStats = {
              booksRead: statsData.totalBooksRead || 0,
              wordsRead: statsData.totalWordsRead || 0,
              lettersRead: statsData.totalLettersRead || 0
            };
          }
        } catch (error) {
          console.error('Error fetching user statistics:', error);
          // Use default values if stats fetch fails
        }
        
        // Fetch recently read books
        let recentlyReadIds: string[] = [];
        
        try {
          const recentlyReadResponse = await fetch(`/api/books/currently-reading`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (recentlyReadResponse.ok) {
            const recentlyReadBooks = await recentlyReadResponse.json();
            recentlyReadIds = recentlyReadBooks.slice(0, 5).map((book: any) => book.id);
          }
        } catch (error) {
          console.error('Error fetching recently read books:', error);
          // Use empty array if fetch fails
        }
        
        // Format the user data to match the expected structure
        const formattedProfile: UserProfile = {
          id: userData.id,
          name: userData.fullName || userData.username,
          username: userData.username,
          bio: userData.bio || '',
          avatar: userData.avatarUrl || '',
          stats: userStats,
          shelves: shelvesWithBooks,
          recentlyReadIds: recentlyReadIds,
          // For now, we're not fetching reading progress, so we'll leave it empty
          readingProgress: []
        };
        
        setProfile(formattedProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить профиль пользователя",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [userId, toast]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Загрузка...</div>;
  }

  if (error || !profile) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-red-500">{error || "Профиль не найден"}</div>;
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Navigation */}
        <header className="flex items-center mb-8">
          {isOwnProfile && (
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="gap-2"
              >
                <Camera className="w-4 h-4" />
                {avatarUploading ? 'Загрузка...' : profile.avatar ? 'Изменить аватар' : 'Добавить аватар'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleEditProfile}>
                Редактировать профиль
              </Button>
              <Button variant="outline" size="sm" className="gap-2 cursor-pointer" onClick={handleShareProfile}>
                <Share2 className="w-4 h-4" />
                Поделиться профилем
              </Button>
              <LogoutButton />
            </div>
          )}
        </header>

        {/* Profile Header */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-start relative group">
              <Avatar className="w-32 h-32 border-4 border-background shadow-xl flex-shrink-0">
                <AvatarImage src={profile.avatar} alt={profile.name} />
                <AvatarFallback className="bg-muted flex items-center justify-center">
                  <User className="w-16 h-16 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="flex-1 space-y-4 w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-serif font-bold">{profile.name}</h1>
                  <p className="text-muted-foreground font-medium">{profile.username}</p>
                  {!isOwnProfile && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="-ml-2 mt-1 p-1 cursor-pointer">
                          <Mail className="w-5 h-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Написать сообщение {profile.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <Textarea 
                            placeholder="Привет! Как тебе последняя книга..." 
                            className="min-h-[150px]"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                          />
                          <div className="flex justify-end">
                            <Button onClick={handleSendMessage} className="cursor-pointer">Отправить</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Bio with HTML rendering - full width below avatar and user info */}
          {(isEditing || profile.bio.trim()) && (
            <div className="mt-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Полное имя</label>
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">О себе</label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="w-full p-2 border rounded-md min-h-[120px]"
                      placeholder="Расскажите о себе..."
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancelEdit}>
                      Отмена
                    </Button>
                    <Button onClick={handleSaveProfile}>
                      Сохранить
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="prose prose-sm dark:prose-invert text-foreground/90 leading-relaxed bg-muted/30 p-6 rounded-lg border w-full"
                  dangerouslySetInnerHTML={{ __html: profile.bio.replace(/\n/g, '<br/>') }}
                />
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-full">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(profile.stats.booksRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Книг прочитано</p>
            </div>
          </div>
          
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-purple-500/10 text-purple-600 rounded-full">
              <AlignLeft className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(profile.stats.wordsRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Слов прочитано</p>
            </div>
          </div>
          
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full">
              <Type className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(profile.stats.lettersRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Букв прочитано</p>
            </div>
          </div>
        </div>

        {/* Recently Read */}
        <section className="mb-12">
          <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-muted-foreground" />
            Недавно читал
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profile.recentlyReadIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет недавно прочитанных книг</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {profile.recentlyReadIds.map((bookId: string) => {
                  // Find the book in the shelves
                  let book = null;
                  for (const shelf of profile.shelves) {
                    if (shelf.books) {
                      book = shelf.books.find(b => b.id === bookId);
                      if (book) break;
                    }
                  }
                  
                  if (!book) return null;
                  
                  return (
                    <BookCard 
                      key={book.id} 
                      book={book} 
                      variant="detailed"
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* User's Shelves */}
        <section>
          <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
            <LibraryIcon className="w-5 h-5 text-muted-foreground" />
            Книжные полки
          </h2>
          <div className="space-y-8">
            {profile.shelves.map((shelf: ProfileShelf) => (
              <div key={shelf.id} className="bg-card/50 border rounded-xl p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg font-bold">{shelf.name}</h3>
                    <Badge variant="secondary" className="rounded-full">{shelf.bookIds.length}</Badge>
                  </div>
                </div>
            
                {shelf.bookIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Полка пуста</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shelf.books?.map((book: Book) => (
                      <BookCard 
                        key={book.id} 
                        book={book} 
                        variant="detailed"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function LibraryIcon({ className }: { className?: string }) {
 return (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m16 6 4 14" />
    <path d="M12 6v14" />
    <path d="M8 8v12" />
    <path d="M4 4v16" />
  </svg>
 )
}