import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, Search, UserPlus, UserMinus, Crown, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';

interface Member {
  id: string;
  userId: string;
  role: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface GroupMembersModalProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  userRole: 'administrator' | 'moderator' | 'member';
  currentUserId: string;
  onMemberUpdate?: () => void;
}

export function GroupMembersModal({ groupId, isOpen, onClose, userRole, currentUserId, onMemberUpdate }: GroupMembersModalProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1
  });
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);

  const canManage = userRole === 'administrator' || userRole === 'moderator';
  const canChangeRoles = userRole === 'administrator';

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen, groupId, currentPage]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredMembers(
        members.filter(m =>
          m.username?.toLowerCase().includes(query) ||
          m.fullName?.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredMembers(members);
    }
  }, [searchQuery, members]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      // Use direct backend URL in development to bypass Vite proxy
      const apiUrl = import.meta.env.DEV
        ? `http://localhost:5001/api/groups/${groupId}/members?page=${currentPage}&limit=20`
        : `/api/groups/${groupId}/members?page=${currentPage}&limit=20`;
      
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Members data:', data);
        setMembers(data.members || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        const error = await response.json();
        console.error('Failed to fetch members:', error);
        toast({
          title: 'Error',
          description: error.error || 'Failed to load members',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }

    try {
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
        const memberIds = members.map(m => m.userId);
        setUserSearchResults(data.filter((u: any) => !memberIds.includes(u.id)));
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const addMember = async (userId: string) => {
    try {
      const apiUrl = import.meta.env.DEV
        ? `http://localhost:5001/api/groups/${groupId}/members`
        : `/api/groups/${groupId}/members`;

      console.log('Adding member with userId:', userId);
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
        setUserSearchQuery('');
        setUserSearchResults([]);
        setInviteDialogOpen(false);
        await fetchMembers();
        if (onMemberUpdate) {
          onMemberUpdate();
        }
      } else {
        const error = await response.json();
        let errorMessage = 'Не удалось добавить участника';
        
        // Provide specific error messages
        if (error.error) {
          if (error.error.includes('already') || error.error.includes('уже')) {
            errorMessage = 'Пользователь уже в группе';
          } else if (error.error.includes('permission') || error.error.includes('доступ')) {
            errorMessage = 'Недостаточно прав для добавления участников';
          } else if (error.error.includes('not found') || error.error.includes('не найден')) {
            errorMessage = 'Пользователь не найден';
          } else {
            errorMessage = error.error;
          }
        }
        
        toast({
          title: 'Ошибка',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Add member error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить участника',
        variant: 'destructive',
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
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
          title: 'Success',
          description: 'Member removed from group',
        });
        await fetchMembers();
        if (onMemberUpdate) {
          onMemberUpdate();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to remove member',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
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
          title: 'Success',
          description: 'Member role updated',
        });
        
        if (data.member) {
          setMembers(prevMembers =>
            prevMembers.map(m => m.id === memberId ? data.member : m)
          );
        } else {
          await fetchMembers();
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update role',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      });
    }
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Group Members {loading ? '...' : `(${pagination.total})`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {canManage && (
              <Button onClick={() => setInviteDialogOpen(!inviteDialogOpen)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite
              </Button>
            )}
          </div>

          {inviteDialogOpen && canManage && (
            <div className="border rounded-lg p-4 space-y-2 flex-shrink-0">
              <Input
                placeholder="Search users to invite..."
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
              />
              {userSearchResults.length > 0 && (
                <ScrollArea className="h-32 border rounded-md">
                  {userSearchResults.map((user) => (
                    <div
                      key={user.id}
                      className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                      onClick={() => addMember(user.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.fullName || user.username}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </div>
                      <UserPlus className="w-4 h-4" />
                    </div>
                  ))}
                </ScrollArea>
              )}
            </div>
          )}

          <ScrollArea className={`border rounded-lg ${inviteDialogOpen ? 'h-[250px]' : 'h-[450px]'}`}>
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading members...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No members found</div>
            ) : (
              <div className="space-y-2 p-2">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/profile/${member.userId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Avatar className="cursor-pointer">
                          <AvatarImage src={member.avatarUrl || undefined} />
                          <AvatarFallback>{member.username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/profile/${member.userId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline cursor-pointer"
                          >
                            {member.fullName || member.username}
                          </Link>
                          {getRoleIcon(member.role)}
                        </div>
                        <p className="text-sm text-muted-foreground">@{member.username}</p>
                      </div>
                    </div>

                    {canManage && (member.role !== 'administrator' || member.userId !== currentUserId) && (
                      <div className="flex items-center gap-2">
                        {canChangeRoles && (
                          <Select
                            value={member.role}
                            onValueChange={(value) => updateMemberRole(member.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="administrator">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMember(member.id)}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
