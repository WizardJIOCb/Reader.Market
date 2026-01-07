import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Settings, Hash, UserPlus, UserMinus, Crown, Shield, Trash2, Plus, X, Search, BookOpen } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

interface Member {
  id: string;
  userId: string;
  role: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
}

interface Book {
  id: string;
  title: string;
  author: string;
}

interface GroupSettingsPanelProps {
  groupId: string;
  isAdmin: boolean;
  isModerator: boolean;
  currentUserId: string;
  onClose?: () => void;
  onChannelsChange?: () => void;
  onMembersChange?: () => void;
  onGroupDeleted?: () => void;
  onGroupUpdated?: () => void;
}

export function GroupSettingsPanel({ groupId, isAdmin, isModerator, currentUserId, onClose, onChannelsChange, onMembersChange, onGroupDeleted, onGroupUpdated }: GroupSettingsPanelProps) {
  const { toast } = useToast();
  const { t } = useTranslation(['messages']);
  const [members, setMembers] = useState<Member[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Group info editing
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupBooks, setGroupBooks] = useState<Book[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState<Book[]>([]);

  useEffect(() => {
    fetchMembers();
    fetchChannels();
    fetchGroupInfo();
  }, [groupId]);

  const fetchMembers = async () => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}/members`
        : `/api/groups/${groupId}/members`;
      
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Handle both old array format and new paginated format
        setMembers(Array.isArray(data) ? data : (data.members || []));
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}/channels`
        : `/api/groups/${groupId}/channels`;
      
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setChannels(data);
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  };

  const fetchGroupInfo = async () => {
    try {
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}`
        : `/api/groups/${groupId}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGroupName(data.name || '');
        setGroupDescription(data.description || '');
        setGroupBooks(data.books || []);
      }
    } catch (error) {
      console.error('Failed to fetch group info:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/users/search?q=${encodeURIComponent(query)}`
        : `/api/users/search?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Filter out users who are already members
        const memberIds = Array.isArray(members) ? members.map((m) => m.userId) : [];
        setSearchResults(data.filter((u: any) => !memberIds.includes(u.id)));
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const searchBooks = async (query: string) => {
    if (query.trim().length < 2) {
      setBookResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Filter out books already added
        const bookIds = groupBooks.map((b) => b.id);
        setBookResults(data.filter((b: any) => !bookIds.includes(b.id)).slice(0, 10));
      }
    } catch (error) {
      console.error('Failed to search books:', error);
    }
  };

  const addMember = async (userId: string) => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}/members`
        : `/api/groups/${groupId}/members`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Участник добавлен в группу',
        });
        setUserSearch('');
        setSearchResults([]);
        // Refresh members locally in the panel
        await fetchMembers();
        // Notify parent component to refresh member count
        if (onMembersChange) {
          onMembersChange();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось добавить участника',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить участника',
        variant: 'destructive',
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}/members/${memberId}`
        : `/api/groups/${groupId}/members/${memberId}`;
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Участник удален из группы',
        });
        setMemberToRemove(null);
        // Refresh members locally in the panel
        await fetchMembers();
        // Notify parent component to refresh member count
        if (onMembersChange) {
          onMembersChange();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось удалить участника',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить участника',
        variant: 'destructive',
      });
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}/members/${memberId}/role`
        : `/api/groups/${groupId}/members/${memberId}/role`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Успех',
          description: 'Роль участника обновлена',
        });
        
        // Update local state with returned member data
        if (data.member) {
          setMembers(prevMembers =>
            prevMembers.map(m => m.id === memberId ? data.member : m)
          );
        } else {
          // Fallback to full refresh if member data not returned
          fetchMembers();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось обновить роль',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить роль',
        variant: 'destructive',
      });
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Название канала обязательно',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}/channels`
        : `/api/groups/${groupId}/channels`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          name: newChannelName.trim(),
          description: newChannelDesc.trim() || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Канал создан',
        });
        setNewChannelName('');
        setNewChannelDesc('');
        // Refresh channels locally in the panel
        await fetchChannels();
        // Notify parent component to refresh channels list
        if (onChannelsChange) {
          onChannelsChange();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось создать канал',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать канал',
        variant: 'destructive',
      });
    }
  };

  const deleteChannel = async (channelId: string) => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}/channels/${channelId}`
        : `/api/groups/${groupId}/channels/${channelId}`;
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Канал удален',
        });
        // Refresh channels locally in the panel
        await fetchChannels();
        // Notify parent component to refresh channels list
        if (onChannelsChange) {
          onChannelsChange();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось удалить канал',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить канал',
        variant: 'destructive',
      });
    }
  };

  const deleteGroup = async () => {
    try {
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}`
        : `/api/groups/${groupId}`;
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        toast({
          title: 'Группа удалена',
          description: 'Группа успешно удалена',
        });
        setDeleteGroupDialogOpen(false);
        // Notify parent component that group was deleted
        if (onGroupDeleted) {
          onGroupDeleted();
        }
        // Close the settings panel
        if (onClose) {
          onClose();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось удалить группу',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить группу',
        variant: 'destructive',
      });
    }
  };

  const updateGroupInfo = async () => {
    try {
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:5001/api/groups/${groupId}`
        : `/api/groups/${groupId}`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          bookIds: groupBooks.map((b) => b.id),
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Информация о группе обновлена',
        });
        if (onGroupUpdated) {
          onGroupUpdated();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось обновить группу',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить группу',
        variant: 'destructive',
      });
    }
  };

  const addBook = (book: Book) => {
    if (!groupBooks.find((b) => b.id === book.id)) {
      setGroupBooks([...groupBooks, book]);
    }
    setBookSearch('');
    setBookResults([]);
  };

  const removeBook = (bookId: string) => {
    setGroupBooks(groupBooks.filter((b) => b.id !== bookId));
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'administrator':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'moderator':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const canManageMembers = isAdmin || isModerator;
  const canManageChannels = isAdmin || isModerator;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          {t('messages:groupSettings')}
        </CardTitle>
        <CardDescription>{t('messages:groupSettingsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              {t('messages:members')}
            </TabsTrigger>
            <TabsTrigger value="channels">
              <Hash className="w-4 h-4 mr-2" />
              {t('messages:channels')}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="settings">
                <Settings className="w-4 h-4 mr-2" />
                {t('messages:groupSettings')}
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="danger">
                <Trash2 className="w-4 h-4 mr-2" />
                {t('messages:deleteGroupTitle')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            {canManageMembers && (
              <div className="space-y-2">
                <Label>{t('messages:inviteMembers')}</Label>
                <div className="relative">
                  <Input
                    placeholder={t('messages:searchUsers')}
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      searchUsers(e.target.value);
                    }}
                  />
                  {searchResults.length > 0 && (
                    <Card className="absolute z-10 w-full mt-1 max-h-48 overflow-auto">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3 border-b last:border-b-0"
                          onClick={() => addMember(user.id)}
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{user.fullName || user.username}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                      ))}
                    </Card>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('messages:members')} ({members.length})</Label>
              <div className="space-y-2">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatarUrl || undefined} />
                          <AvatarFallback>{member.username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{member.fullName || member.username}</p>
                            {getRoleIcon(member.role)}
                          </div>
                          <p className="text-sm text-muted-foreground">@{member.username}</p>
                        </div>
                      </div>
                      {canManageMembers && (member.role !== 'administrator' || member.userId !== currentUserId) && (
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <Select
                              value={member.role}
                              onValueChange={(value) => updateMemberRole(member.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">{t('messages:member')}</SelectItem>
                                <SelectItem value="moderator">{t('messages:moderator')}</SelectItem>
                                {isAdmin && <SelectItem value="administrator">{t('messages:administrator')}</SelectItem>}
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMemberToRemove(member)}
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="channels" className="space-y-4">
            {canManageChannels && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('messages:addChannel')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="channelName">{t('messages:channelNameLabel')}</Label>
                    <Input
                      id="channelName"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder={t('messages:channelNamePlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channelDesc">{t('messages:channelDescriptionPlaceholder')}</Label>
                    <Input
                      id="channelDesc"
                      value={newChannelDesc}
                      onChange={(e) => setNewChannelDesc(e.target.value)}
                      placeholder={t('messages:channelDescriptionPlaceholder')}
                    />
                  </div>
                  <Button onClick={createChannel} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('messages:addChannel')}
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>{t('messages:channels')} ({channels.length})</Label>
              <div className="space-y-2">
                {channels.map((channel) => (
                  <Card key={channel.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          <p className="font-medium">{channel.name}</p>
                        </div>
                        {channel.description && (
                          <p className="text-sm text-muted-foreground ml-6">{channel.description}</p>
                        )}
                      </div>
                      {canManageChannels && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteChannel(channel.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('messages:groupInfoTitle')}</CardTitle>
                  <CardDescription>{t('messages:groupInfoDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="groupName">{t('messages:groupNameLabel')}</Label>
                    <Input
                      id="groupName"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder={t('messages:groupNamePlaceholder')}
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="groupDescription">{t('messages:descriptionLabel')}</Label>
                    <Textarea
                      id="groupDescription"
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      placeholder={t('messages:descriptionPlaceholder')}
                      rows={3}
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="groupBooks">{t('messages:groupBooksLabel')}</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="groupBooks"
                        value={bookSearch}
                        onChange={(e) => {
                          setBookSearch(e.target.value);
                          searchBooks(e.target.value);
                        }}
                        placeholder={t('messages:searchToAddBooks')}
                        className="pl-10"
                      />
                    </div>
                    {bookResults.length > 0 && (
                      <Card className="absolute z-10 w-full mt-1 max-h-48 overflow-auto">
                        {bookResults.map((book) => (
                          <div
                            key={book.id}
                            className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            onClick={() => addBook(book)}
                          >
                            <p className="font-medium text-sm">{book.title}</p>
                            <p className="text-xs text-muted-foreground">{book.author}</p>
                          </div>
                        ))}
                      </Card>
                    )}
                    {groupBooks.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {groupBooks.map((book) => (
                          <Badge key={book.id} variant="secondary" className="pl-3 pr-1">
                            <span className="mr-1">{book.title}</span>
                            <button
                              onClick={() => removeBook(book.id)}
                              className="ml-1 hover:bg-muted rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button onClick={updateGroupInfo} className="w-full">
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t('messages:updateGroupInfo')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="danger" className="space-y-4">
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-base text-destructive">{t('messages:deleteGroupTitle')}</CardTitle>
                  <CardDescription>
                    {t('messages:confirmDeleteGroupDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteGroupDialogOpen(true)}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('messages:deleteGroupButton')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>

      {/* Remove member confirmation dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages:confirmRemoveMember')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages:confirmRemoveMemberDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('messages:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => memberToRemove && removeMember(memberToRemove.id)}>
              {t('messages:remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete group confirmation dialog */}
      <AlertDialog open={deleteGroupDialogOpen} onOpenChange={setDeleteGroupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t('messages:confirmDeleteGroup')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages:confirmDeleteGroupDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('messages:cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('messages:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
