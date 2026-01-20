import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import SearchInput from '../components/SearchInput';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '../components/ui/pagination';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter,
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '../components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '../components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { Edit, User, Ban } from 'lucide-react';
import { formatAbsoluteDateTime } from '../lib/dateUtils';
import { ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface User {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  avatarUrl?: string | null;
  accessLevel: string;
  isBlocked?: boolean;
  blockReason?: string | null;
  createdAt: string;
  lastLogin: string | null;
  lastActivity: string | null;
  shelvesCount: number;
  booksOnShelvesCount: number;
  commentsCount: number;
  reviewsCount: number;
}

interface UserWithStats {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const { i18n, t } = useTranslation(['admin', 'common']);
  const dateLocale = i18n.language === 'ru' ? ru : enUS;
  const { toast } = useToast();
  const [pagination, setPagination] = useState({
    page: 1,
    limit: (() => {
      const saved = localStorage.getItem('admin_users_limit');
      return saved ? parseInt(saved) : 10;
    })(),
    total: 0,
    pages: 1
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [openChangePassword, setOpenChangePassword] = useState(false);
  const [openChangeAccessLevel, setOpenChangeAccessLevel] = useState(false);
  const [openEditUser, setOpenEditUser] = useState(false);
  const [editFormData, setEditFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    bio: ''
  });

  // Save pagination limit to localStorage
  useEffect(() => {
    localStorage.setItem('admin_users_limit', pagination.limit.toString());
  }, [pagination.limit]);
  const [newAccessLevel, setNewAccessLevel] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async (page: number = 1, searchTerm: string = '') => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data: UserWithStats = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: t('admin:common.error'),
        description: t('admin:users.failedToLoad'),
        variant: "destructive"
      });
      setLoading(false);
    }
  }, [pagination.limit, toast]);

  useEffect(() => {
    fetchUsers(1, debouncedSearch);
  }, [debouncedSearch, fetchUsers]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchUsers(newPage, debouncedSearch);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      toast({
        title: t('admin:common.success'),
        description: t('admin:users.userUpdated')
      });

      setOpenEditUser(false);
      setSelectedUser(null);
      
      // Refresh the user list
      fetchUsers(pagination.page, debouncedSearch);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: t('admin:common.error'),
        description: t('admin:users.failedToUpdate'),
        variant: "destructive"
      });
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    if (newPassword !== confirmNewPassword) {
      toast({
        title: t('admin:common.error'),
        description: t('admin:users.passwordsDoNotMatch'),
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        throw new Error('Failed to change password');
      }

      toast({
        title: t('admin:common.success'),
        description: t('admin:users.passwordChanged')
      });

      setOpenChangePassword(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: t('admin:common.error'),
        description: t('admin:users.failedToChangePassword'),
        variant: "destructive"
      });
    }
  };

  const handleImpersonate = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}/impersonate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate impersonation token');
      }

      const data = await response.json();
      
      // Immediately open the impersonation window
      const impersonateWindow = window.open('about:blank', '_blank');
      if (impersonateWindow) {
        // Set the auth token in the new window's localStorage
        impersonateWindow.localStorage.setItem('authToken', data.token);
        
        // Prepare the user data to store
        const userData = {
          id: data.user.id,
          username: data.user.username,
          fullName: data.user.fullName || data.user.username,
          email: data.user.email
        };
        impersonateWindow.localStorage.setItem('userData', JSON.stringify(userData));
        
        // Navigate to the user's profile page
        impersonateWindow.location.href = `/profile/${data.user.username}`;
        
        toast({
          title: t('admin:common.success'),
          description: t('admin:users.impersonating', { username: data.user.username })
        });
      }
    } catch (error) {
      console.error('Error impersonating user:', error);
      toast({
        title: t('admin:common.error'),
        description: t('admin:users.failedToImpersonate'),
        variant: "destructive"
      });
    }
  };

  const handleChangeAccessLevel = async () => {
    if (!selectedUser) return;

    try {
      const payload: any = {
        accessLevel: newAccessLevel === 'blocked' ? selectedUser.accessLevel : newAccessLevel,
        isBlocked: newAccessLevel === 'blocked',
        blockReason: newAccessLevel === 'blocked' ? blockReason : null
      };

      const response = await fetch(`/api/admin/users/${selectedUser.id}/access-level`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to change access level');
      }

      toast({
        title: t('admin:common.success'),
        description: newAccessLevel === 'blocked' 
          ? t('admin:users.userBlocked')
          : t('admin:users.accessLevelChanged')
      });

      setOpenChangeAccessLevel(false);
      setNewAccessLevel('');
      setBlockReason('');
      setSelectedUser(null);
      
      // Refresh the user list
      fetchUsers(pagination.page, debouncedSearch);
    } catch (error) {
      console.error('Error changing access level:', error);
      toast({
        title: t('admin:common.error'),
        description: t('admin:users.failedToUpdate'),
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('admin:users.never');
    return formatAbsoluteDateTime(dateString, dateLocale);
  };

  const getAccessLevelBadgeVariant = (level: string) => {
    switch (level) {
      case 'admin':
        return 'destructive';
      case 'moder':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const isInitialLoad = loading && users.length === 0;
  
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">{t('admin:common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin:users.title')}</CardTitle>
          <div className="flex items-center gap-4 mt-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('admin:users.searchPlaceholder')}
            />
            <Select 
              value={pagination.limit.toString()} 
              onValueChange={(value) => {
                setPagination((prev) => ({ ...prev, limit: parseInt(value), page: 1 }));
              }}
            >
              <SelectTrigger className="w-[140px]">
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
            {debouncedSearch && (
              <Button
                variant="outline"
                onClick={() => setSearch('')}
              >
                {t('admin:common.clear')}
              </Button>
            )}
          </div>
          {debouncedSearch && (
            <p className="text-sm text-muted-foreground mt-2">
              {t('admin:users.searchResults')}: "{debouncedSearch}"
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin:users.avatar')}</TableHead>
                <TableHead>{t('admin:users.login')}</TableHead>
                <TableHead>{t('admin:users.name')}</TableHead>
                <TableHead>{t('admin:users.email')}</TableHead>
                <TableHead>{t('admin:users.status')}</TableHead>
                <TableHead>{t('admin:users.registrationDate')}</TableHead>
                <TableHead>{t('admin:users.lastLogin')}</TableHead>
                <TableHead>{t('admin:users.lastActivity')}</TableHead>
                <TableHead>{t('admin:users.shelves')}</TableHead>
                <TableHead>{t('admin:users.books')}</TableHead>
                <TableHead>{t('admin:users.comments')}</TableHead>
                <TableHead>{t('admin:users.reviews')}</TableHead>
                <TableHead>{t('admin:users.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Avatar className="w-8 h-8">
                      {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={user.username} />
                      ) : null}
                      <AvatarFallback>
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/profile/${user.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {user.username}
                      </a>
                      {user.isBlocked && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          {t('admin:users.blocked')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{user.fullName || t('admin:common.na')}</TableCell>
                  <TableCell>{user.email || t('admin:common.na')}</TableCell>
                  <TableCell>
                    <Badge variant={getAccessLevelBadgeVariant(user.accessLevel)}>
                      {user.accessLevel.charAt(0).toUpperCase() + user.accessLevel.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{formatDate(user.lastLogin)}</TableCell>
                  <TableCell>{formatDate(user.lastActivity)}</TableCell>
                  <TableCell>{user.shelvesCount}</TableCell>
                  <TableCell>{user.booksOnShelvesCount}</TableCell>
                  <TableCell>{user.commentsCount}</TableCell>
                  <TableCell>{user.reviewsCount}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setEditFormData({
                            username: user.username,
                            fullName: user.fullName || '',
                            email: user.email || '',
                            bio: ''
                          });
                          setOpenEditUser(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        {t('admin:users.edit')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setOpenChangePassword(true);
                        }}
                      >
                        {t('admin:users.changePassword')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleImpersonate(user)}
                      >
                        {t('admin:users.impersonate')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setNewAccessLevel(user.accessLevel);
                          setOpenChangeAccessLevel(true);
                        }}
                      >
                        {t('admin:users.changeAccessLevel')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => handlePageChange(pagination.page - 1)} 
                    className={pagination.page === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                
                {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                  const pageNum = Math.max(1, Math.min(
                    pagination.page - 2, 
                    pagination.pages - 4
                  )) + i;
                  
                  if (pageNum <= 0 || pageNum > pagination.pages) return null;
                  
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={pagination.page === pageNum}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => handlePageChange(pagination.page + 1)} 
                    className={pagination.page === pagination.pages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={openChangePassword} onOpenChange={setOpenChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:users.changePasswordFor', { username: selectedUser?.username })}</DialogTitle>
            <DialogDescription>
              {t('admin:users.enterNewPassword')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder={t('admin:users.newPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder={t('admin:users.confirmNewPassword')}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setOpenChangePassword(false);
                setNewPassword('');
                setConfirmNewPassword('');
                setSelectedUser(null);
              }}
            >
              {t('admin:common.cancel')}
            </Button>
            <Button onClick={handleChangePassword}>
              {t('admin:users.changePassword')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Access Level Dialog */}
      <Dialog open={openChangeAccessLevel} onOpenChange={setOpenChangeAccessLevel}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin:users.changeAccessLevelFor', { username: selectedUser?.username })}</DialogTitle>
            <DialogDescription>
              {t('admin:users.selectNewAccessLevel')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-level">{t('admin:users.accessLevel')}</Label>
              <select
                id="access-level"
                className="w-full p-2 border rounded-md"
                value={newAccessLevel}
                onChange={(e) => {
                  setNewAccessLevel(e.target.value);
                  if (e.target.value !== 'blocked') {
                    setBlockReason('');
                  }
                }}
              >
                <option value="">{t('admin:users.selectAccessLevel')}</option>
                <option value="user">{t('admin:users.user')}</option>
                <option value="moder">{t('admin:users.moderator')}</option>
                <option value="admin">{t('admin:users.admin')}</option>
                <option value="blocked">{t('admin:users.blocked')}</option>
              </select>
            </div>
            
            {newAccessLevel === 'blocked' && (
              <div className="space-y-2">
                <Label htmlFor="block-reason">{t('admin:users.blockReason')}</Label>
                <textarea
                  id="block-reason"
                  className="w-full p-2 border rounded-md min-h-[100px]"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder={t('admin:users.blockReasonPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin:users.blockReasonHelp')}
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setOpenChangeAccessLevel(false);
                setNewAccessLevel('');
                setBlockReason('');
                setSelectedUser(null);
              }}
            >
              {t('admin:common.cancel')}
            </Button>
            <Button onClick={handleChangeAccessLevel} disabled={!newAccessLevel}>
              {newAccessLevel === 'blocked' ? t('admin:users.blockUser') : t('admin:users.updateAccessLevel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={openEditUser} onOpenChange={setOpenEditUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:users.editUser', { username: selectedUser?.username })}</DialogTitle>
            <DialogDescription>
              {t('admin:users.updateUserInfo')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">{t('admin:users.loginUsername')}</Label>
              <Input
                id="edit-username"
                value={editFormData.username}
                onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                placeholder={t('admin:users.username')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">{t('admin:users.fullName')}</Label>
              <Input
                id="edit-fullName"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                placeholder={t('admin:users.fullName')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">{t('admin:users.email')}</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder={t('admin:users.email')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bio">{t('admin:users.bio')}</Label>
              <Input
                id="edit-bio"
                value={editFormData.bio}
                onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                placeholder={t('admin:users.bioOptional')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setOpenEditUser(false);
                setSelectedUser(null);
              }}
            >
              {t('admin:common.cancel')}
            </Button>
            <Button onClick={handleEditUser}>
              {t('admin:users.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;