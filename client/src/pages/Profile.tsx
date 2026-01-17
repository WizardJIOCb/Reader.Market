import React, { useState, useEffect, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { AddToShelfDialog } from '@/components/AddToShelfDialog';
import { BookCard } from '@/components/BookCard';
import ProfileRatingsSection from '@/components/ProfileRatingsSection';
import { useAuth } from '@/lib/auth';
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
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Pencil,
  Globe,
  Key
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

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
  const { user: currentUser, refreshUser, logout, isLoading: authLoading } = useAuth();
  const userId = params?.userId;
  const { t, i18n } = useTranslation(['profile', 'notifications', 'common']);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const languageSectionRef = useRef<HTMLDivElement>(null);
  
  // Profile ratings state
  const [profileRating, setProfileRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  
  // State for expanded book lists (carousel vs full view)
  const [expandedRecentlyRead, setExpandedRecentlyRead] = useState(false);
  const [expandedShelves, setExpandedShelves] = useState<Record<string, boolean>>({});
  const recentlyReadScrollRef = useRef<HTMLDivElement>(null);
  const shelfScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [, setLocation] = useLocation();
  
  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Redirect to own profile if no userId specified and user is logged in
  useEffect(() => {
    if (!userId && currentUser?.username) {
      setLocation(`/profile/${currentUser.username}`, { replace: true });
    }
  }, [userId, currentUser, setLocation]);

  // Determine if viewing own profile
  const isOwnProfile = currentUser?.id === userId || currentUser?.username === userId;
  
  // Sync selectedLanguage with current user's language preference
  useEffect(() => {
    if (currentUser?.language) {
      console.log('Profile: Syncing selectedLanguage with currentUser.language:', currentUser.language);
      setSelectedLanguage(currentUser.language);
      // Also ensure i18n is in sync
      if (i18n.language !== currentUser.language) {
        console.log('Profile: i18n language mismatch, updating from', i18n.language, 'to', currentUser.language);
        i18n.changeLanguage(currentUser.language);
      }
    } else {
      // If user has no language preference, sync with current i18n language
      console.log('Profile: No user language preference, using i18n language:', i18n.language);
      setSelectedLanguage(i18n.language);
    }
  }, [currentUser, i18n]);

  const handleLanguageChange = async (newLanguage: string) => {
    try {
      console.log('Language change requested:', newLanguage);
      console.log('Current i18n language:', i18n.language);
      
      setSelectedLanguage(newLanguage);
      
      // Update UI language immediately and wait for it to complete
      // This also updates localStorage 'i18nextLng' automatically
      await i18n.changeLanguage(newLanguage);
      console.log('i18n language changed to:', i18n.language);
      console.log('localStorage i18nextLng:', localStorage.getItem('i18nextLng'));
      
      // Force a small delay to ensure all components have time to re-render
      // This helps with components that might be slow to subscribe to language changes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // If user is authenticated, save to backend
      if (isOwnProfile && currentUser) {
        // Use direct backend URL in development to bypass Vite proxy
        // Per project standards for PUT/POST/DELETE requests
        const apiUrl = import.meta.env.DEV 
          ? 'http://localhost:5001/api/profile/language'
          : '/api/profile/language';
        
        console.log('Saving language to backend:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ language: newLanguage })
        });
        
        console.log('Backend response status:', response.status);
        console.log('Backend response headers:', response.headers.get('content-type'));
        
        // Check response content type to detect HTML responses
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Received non-JSON response:', contentType);
          throw new Error('Server returned HTML instead of JSON. Please try again.');
        }
        
        if (response.ok) {
          const data = await response.json();
          console.log('Backend response data:', data);
          
          // Update local storage with new user data
          localStorage.setItem('userData', JSON.stringify(data.user));
          
          // Update current user in auth context without calling refreshUser
          // to avoid potential race conditions
          if (refreshUser) {
            await refreshUser();
          }
          
          // Ensure i18nextLng is in sync with user preference
          // This is critical for page reloads
          localStorage.setItem('i18nextLng', newLanguage);
          console.log('Synchronized i18nextLng with user preference:', newLanguage);
          
          toast({
            title: t('notifications:success.languageUpdated'),
            description: t('notifications:success.languageDescription'),
          });
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Backend error:', errorData);
          throw new Error(errorData.error || 'Failed to update language preference');
        }
      } else {
        console.log('Not saving to backend - not own profile or not authenticated');
      }
    } catch (error) {
      console.error('Language update error:', error);
      toast({
        title: t('notifications:error.title'),
        description: error instanceof Error ? error.message : t('notifications:error.updateFailed'),
        variant: "destructive"
      });
      // Revert language on error
      const previousLanguage = i18n.language;
      console.log('Reverting to previous language:', previousLanguage);
      await i18n.changeLanguage(previousLanguage);
      setSelectedLanguage(previousLanguage);
    }
  };

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
        title: t('notifications:success.messageSent'),
        description: t('notifications:success.messageDescription'),
      });
      setMessage('');
    } catch (err) {
      toast({
        title: t('notifications:error.title'),
        description: err instanceof Error ? err.message : t('notifications:error.sendFailed'),
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
        title: t('notifications:success.profileUpdated'),
        description: t('notifications:success.profileDescription')
      });
    } catch (err) {
      toast({
        title: t('notifications:error.title'),
        description: err instanceof Error ? err.message : t('notifications:error.updateFailed'),
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
        title: t('notifications:error.title'),
        description: t('notifications:error.invalidImageFormat'),
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('notifications:error.title'),
        description: t('notifications:error.fileTooLarge'),
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
        title: t('notifications:success.avatarUpdated'),
        description: t('notifications:success.avatarDescription')
      });
    } catch (err) {
      toast({
        title: t('notifications:error.title'),
        description: err instanceof Error ? err.message : t('notifications:error.uploadFailed'),
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
        title: t('notifications:success.avatarDeleted'),
        description: t('notifications:success.avatarDeletedDescription')
      });
    } catch (err) {
      toast({
        title: t('notifications:error.title'),
        description: err instanceof Error ? err.message : t('notifications:error.updateFailed'),
        variant: "destructive"
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    
    try {
      const profileUrl = `${window.location.origin}/profile/${profile.username}`;
      await navigator.clipboard.writeText(profileUrl);
      
      toast({
        title: t('notifications:success.linkCopied'),
        description: t('notifications:success.linkDescription')
      });
    } catch (err) {
      toast({
        title: t('notifications:error.title'),
        description: err instanceof Error ? err.message : t('notifications:error.copyFailed'),
        variant: "destructive"
      });
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword.trim()) {
      toast({
        title: t('notifications:error.title'),
        description: t('profile:currentPasswordRequired'),
        variant: "destructive"
      });
      return;
    }
    
    if (!newPassword.trim()) {
      toast({
        title: t('notifications:error.title'),
        description: t('profile:newPasswordRequired'),
        variant: "destructive"
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: t('notifications:error.title'),
        description: t('profile:passwordTooShort'),
        variant: "destructive"
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: t('notifications:error.title'),
        description: t('profile:passwordMismatch'),
        variant: "destructive"
      });
      return;
    }
    
    try {
      setPasswordChanging(true);
      const token = localStorage.getItem('authToken');
      
      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:5001/api/profile/password'
        : '/api/profile/password';
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }
      
      toast({
        title: t('notifications:success.title'),
        description: t('profile:passwordChanged')
      });
      
      // Reset form and close dialog
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordDialogOpen(false);
    } catch (err) {
      toast({
        title: t('notifications:error.title'),
        description: err instanceof Error ? err.message : t('notifications:error.updateFailed'),
        variant: "destructive"
      });
    } finally {
      setPasswordChanging(false);
    }
  };


  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      // Wait for auth to finish loading before fetching profile
      if (authLoading) return;
      
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/profile/${userId}`, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        
        const userData = await response.json();
        
        // Profile rating is now included in the userData response
        const profileRating = userData.profileRating || null;
        const ratingCount = userData.ratingCount || 0;
        
        // Format the user data to match the expected structure
        // Fetch user's shelves based on whether it's the current user or another user
        let shelves = [];
        if (isOwnProfile && token) {
          // Fetch current user's shelves
          const shelvesResponse = await fetch(`/api/shelves`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (shelvesResponse.ok) {
            shelves = await shelvesResponse.json();
          }
        } else {
          // Fetch other user's shelves
          const userShelvesResponse = await fetch(`/api/shelves/user/${userId}`, {
            headers: token ? {
              'Authorization': `Bearer ${token}`
            } : {}
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
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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
            headers: token ? {
              'Authorization': `Bearer ${token}`
            } : {}
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
        
        // Fetch recently read books (only for own profile)
        let recentlyReadIds: string[] = [];
        
        if (isOwnProfile && token) {
          try {
            const recentlyReadResponse = await fetch(`/api/books/currently-reading`, {
              headers: {
                'Authorization': `Bearer ${token}`
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
        setProfileRating(profileRating);
        setRatingCount(ratingCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        toast({
          title: t('notifications:error.title'),
          description: t('notifications:error.profileLoadFailed'),
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [userId, toast, authLoading, currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t('profile:loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-red-500">{error || t('profile:notFound')}</div>;
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };

  // Format bio text: convert URLs to clickable links and newlines to <br/>
  const formatBioHtml = (text: string) => {
    // First escape any HTML
    let result = text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // URL regex pattern - matches http(s):// URLs and www. URLs
    const urlPattern = /(https?:\/\/[^\s<]+)/g;
    const wwwPattern = /(^|[\s])www\.([^\s<]+)/g;
    
    // Convert https?:// URLs to links
    result = result.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>');
    
    // Convert www. URLs to links (prepend https://)
    result = result.replace(wwwPattern, '$1<a href="https://www.$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">www.$2</a>');
    
    // Convert newlines to <br/>
    return result.replace(/\n/g, '<br/>');
  };

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hidden file input for avatar upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleAvatarUpload}
          className="hidden"
        />

        {/* Profile Header */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="flex flex-col items-center md:items-start relative group">
              <Avatar className="w-48 h-48 border-4 border-background shadow-xl flex-shrink-0 overflow-hidden">
                <AvatarImage 
                  src={profile.avatar} 
                  alt={profile.name}
                  className="w-full h-auto object-contain"
                />
                <AvatarFallback className="bg-muted flex items-center justify-center">
                  <User className="w-24 h-24 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="flex-1 space-y-2 w-full text-center md:text-left">
              <div>
                <h1 className="text-3xl font-serif font-bold">{profile.name}</h1>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <p className="text-muted-foreground font-medium">{profile.username}</p>
                  {isOwnProfile && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full h-7 w-7">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}>
                          <Camera className="w-4 h-4 mr-2" />
                          {profile.avatar ? t('profile:changeAvatar') : t('profile:uploadAvatar')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleEditProfile}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {t('profile:editProfile')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleShareProfile}>
                          <Share2 className="w-4 h-4 mr-2" />
                          {t('profile:shareProfile')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTimeout(() => languageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)}>
                          <Globe className="w-4 h-4 mr-2" />
                          {t('profile:languagePreference')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
                          <Key className="w-4 h-4 mr-2" />
                          {t('profile:changePassword')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { logout(); setLocation('/login'); }} className="text-red-600">
                          <LogOut className="w-4 h-4 mr-2" />
                          {t('common:logout')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {!isOwnProfile && (
                    <Link href={`/messages?user=${profile.id}`} className="cursor-pointer">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </div>
                
                {/* Profile Rating Display - moved here */}
                {profileRating !== null && typeof profileRating === 'number' && (
                  <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                    <Badge variant={profileRating >= 8 ? 'default' : profileRating >= 5 ? 'secondary' : 'destructive'}>
                      ⭐ {profileRating.toFixed(1)}/10
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {t('profile:ratings.from')} {ratingCount} {ratingCount === 1 ? t('profile:ratings.rating') : t('profile:ratings.ratingsPlural')}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Bio - displayed to the right of avatar */}
              {!isEditing && profile.bio.trim() && (
                <div 
                  className="prose prose-sm dark:prose-invert text-foreground/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatBioHtml(profile.bio) }}
                />
              )}
            </div>
          </div>
          
          {/* Bio editing form - full width below avatar and user info */}
          {isEditing && (
            <div className="mt-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('profile:fullName')}</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('profile:bio')}</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full p-2 border rounded-md min-h-[120px]"
                    placeholder={t('profile:bioPlaceholder')}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    {t('profile:cancel')}
                  </Button>
                  <Button onClick={handleSaveProfile}>
                    {t('profile:saveProfile')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Ratings & Comments Section */}
        <div className="mt-4 mb-8">
          <ProfileRatingsSection
            profileId={profile.id}
            profileUsername={profile.username}
            isOwnProfile={isOwnProfile}
            averageRating={profileRating}
            ratingCount={ratingCount}
            onRatingChange={(newRating) => {
              // Refetch ratings when changed
              fetch(`/api/profile/${profile.id}/ratings`)
                .then(res => res.json())
                .then(ratings => {
                  if (ratings.length > 0) {
                    const avgRating = ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length;
                    setProfileRating(Math.round(avgRating * 10) / 10);
                    setRatingCount(ratings.length);
                  } else {
                    setProfileRating(null);
                    setRatingCount(0);
                  }
                })
                .catch(err => console.error('Error refetching ratings:', err));
            }}
          />
        </div>

        {/* Stats Grid - Hidden for now */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-full">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(profile.stats.booksRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('profile:stats.booksRead')}</p>
            </div>
          </div>
          
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-purple-500/10 text-purple-600 rounded-full">
              <AlignLeft className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(profile.stats.wordsRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('profile:stats.wordsRead')}</p>
            </div>
          </div>
          
          <div className="bg-card border p-6 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full">
              <Type className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">{formatNumber(profile.stats.lettersRead)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('profile:stats.lettersRead')}</p>
            </div>
          </div>
        </div> */}

        {/* Recently Read */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif font-bold flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-muted-foreground" />
              {t('profile:recentlyRead')}
            </h2>
            {profile.recentlyReadIds.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setExpandedRecentlyRead(!expandedRecentlyRead)}
              >
                {expandedRecentlyRead ? t('profile:collapse') : t('profile:showAll')}
              </Button>
            )}
          </div>
          {profile.recentlyReadIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile:noRecentBooks')}</p>
          ) : expandedRecentlyRead ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {profile.recentlyReadIds.map((bookId: string) => {
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
          ) : (
            <div className="relative group">
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  if (recentlyReadScrollRef.current) {
                    recentlyReadScrollRef.current.scrollBy({ left: -400, behavior: 'smooth' });
                  }
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div 
                ref={recentlyReadScrollRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {profile.recentlyReadIds.map((bookId: string) => {
                  let book = null;
                  for (const shelf of profile.shelves) {
                    if (shelf.books) {
                      book = shelf.books.find(b => b.id === bookId);
                      if (book) break;
                    }
                  }
                  if (!book) return null;
                  return (
                    <div key={book.id} className="flex-shrink-0 w-[calc(85%-8px)] md:w-[calc(33.333%-11px)]">
                      <BookCard 
                        book={book} 
                        variant="detailed"
                      />
                    </div>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  if (recentlyReadScrollRef.current) {
                    recentlyReadScrollRef.current.scrollBy({ left: 400, behavior: 'smooth' });
                  }
                }}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </section>

        {/* User's Shelves */}
        <section>
          {(() => {
            // Filter shelves based on profile ownership
            // Show all shelves if viewing own profile, otherwise hide empty shelves
            const filteredShelves = isOwnProfile 
              ? profile.shelves 
              : profile.shelves.filter((shelf: ProfileShelf) => shelf.bookIds.length > 0);
            
            // Count non-empty shelves for the counter
            const nonEmptyShelfCount = profile.shelves.filter((shelf: ProfileShelf) => shelf.bookIds.length > 0).length;
            
            return (
              <>
                <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                  <LibraryIcon className="w-5 h-5 text-muted-foreground" />
                  {t('profile:shelves')} [{nonEmptyShelfCount}]
                </h2>
                <div className="space-y-10">
                  {filteredShelves.map((shelf: ProfileShelf) => {
                    const isExpanded = expandedShelves[shelf.id] || false;
                    
                    return (
                      <div key={shelf.id}>
                        <div className="flex items-baseline justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <h3 className="font-serif text-lg font-bold">{shelf.name}</h3>
                            <Badge variant="secondary" className="rounded-full">{shelf.bookIds.length}</Badge>
                          </div>
                          {shelf.bookIds.length > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setExpandedShelves(prev => ({ ...prev, [shelf.id]: !isExpanded }))}
                            >
                              {isExpanded ? t('profile:collapse') : t('profile:showAll')}
                            </Button>
                          )}
                        </div>
                    
                        {shelf.bookIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('profile:emptyShelf')}</p>
                        ) : isExpanded ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {shelf.books?.map((book: Book) => (
                              <BookCard 
                                key={book.id} 
                                book={book} 
                                variant="detailed"
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="relative group">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const scrollEl = shelfScrollRefs.current[shelf.id];
                                if (scrollEl) {
                                  scrollEl.scrollBy({ left: -400, behavior: 'smooth' });
                                }
                              }}
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </Button>
                            <div 
                              ref={(el) => { shelfScrollRefs.current[shelf.id] = el; }}
                              className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 scroll-smooth"
                              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                              {shelf.books?.map((book: Book) => (
                                <div key={book.id} className="flex-shrink-0 w-[calc(85%-8px)] md:w-[calc(33.333%-11px)]">
                                  <BookCard 
                                    book={book} 
                                    variant="detailed"
                                  />
                                </div>
                              ))}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const scrollEl = shelfScrollRefs.current[shelf.id];
                                if (scrollEl) {
                                  scrollEl.scrollBy({ left: 400, behavior: 'smooth' });
                                }
                              }}
                            >
                              <ChevronRight className="w-5 h-5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </section>

        {/* Language Preference Section - Only for own profile */}
        {isOwnProfile && (
          <section className="mt-12" ref={languageSectionRef}>
            <div className="bg-card border p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-serif font-bold mb-2">{t('profile:languagePreference')}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t('profile:languageDescription')}</p>
              
              <RadioGroup value={selectedLanguage} onValueChange={handleLanguageChange}>
                <div className="flex items-center space-x-2 mb-3">
                  <RadioGroupItem value="en" id="lang-en" />
                  <Label htmlFor="lang-en" className="cursor-pointer">
                    {t('profile:english')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ru" id="lang-ru" />
                  <Label htmlFor="lang-ru" className="cursor-pointer">
                    {t('profile:russian')}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </section>
        )}
      </div>
      
      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('profile:changePassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('profile:currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('profile:newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('profile:confirmNewPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setPasswordDialogOpen(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }}>
              {t('profile:cancel')}
            </Button>
            <Button onClick={handleChangePassword} disabled={passwordChanging}>
              {passwordChanging ? t('common:loading') : t('profile:saveProfile')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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