import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
import { useToast } from '../hooks/use-toast';

interface User {
  id: string;
  username: string;
  fullName: string;
  accessLevel: string;
  createdAt: string;
  lastLogin: string | null;
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
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [openChangePassword, setOpenChangePassword] = useState(false);
  const [openImpersonate, setOpenImpersonate] = useState(false);
  const [openChangeAccessLevel, setOpenChangeAccessLevel] = useState(false);
  const [newAccessLevel, setNewAccessLevel] = useState('');
  const [impersonationToken, setImpersonationToken] = useState('');
  const [impersonationUser, setImpersonationUser] = useState<User | null>(null);
  const { toast } = useToast();

  const fetchUsers = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users?page=${page}&limit=${pagination.limit}`, {
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
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []); // Fetch users on component mount

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchUsers(newPage);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
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
        title: "Success",
        description: "Password changed successfully"
      });

      setOpenChangePassword(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: "Failed to change password. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleImpersonate = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/impersonate`, {
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
      setImpersonationToken(data.token);
      setImpersonationUser(data.user);
      setOpenImpersonate(true);
    } catch (error) {
      console.error('Error impersonating user:', error);
      toast({
        title: "Error",
        description: "Failed to impersonate user. Please try again.",
        variant: "destructive"
      });
    }
  };

  const openImpersonateWindow = () => {
    if (!impersonationToken || !impersonationUser) return;

    // Create a new window and set the token in localStorage
    const impersonateWindow = window.open('', '_blank');
    if (impersonateWindow) {
      impersonateWindow.localStorage.setItem('token', impersonationToken);
      impersonateWindow.location.href = '/';
      toast({
        title: "Success",
        description: `Now impersonating ${impersonationUser.username}`
      });
    }
  };

  const handleChangeAccessLevel = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/access-level`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accessLevel: newAccessLevel })
      });

      if (!response.ok) {
        throw new Error('Failed to change access level');
      }

      toast({
        title: "Success",
        description: "Access level changed successfully"
      });

      setOpenChangeAccessLevel(false);
      setNewAccessLevel('');
      setSelectedUser(null);
      
      // Refresh the user list
      fetchUsers(pagination.page);
    } catch (error) {
      console.error('Error changing access level:', error);
      toast({
        title: "Error",
        description: "Failed to change access level. Please try again.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Login</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registration Date</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Shelves</TableHead>
                <TableHead>Books</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.fullName || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={getAccessLevelBadgeVariant(user.accessLevel)}>
                      {user.accessLevel.charAt(0).toUpperCase() + user.accessLevel.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{formatDate(user.lastLogin)}</TableCell>
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
                          setOpenChangePassword(true);
                        }}
                      >
                        Change Password
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          handleImpersonate();
                        }}
                      >
                        Impersonate
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
                        Change Access Level
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
            <DialogTitle>Change Password for {selectedUser?.username}</DialogTitle>
            <DialogDescription>
              Enter a new password for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
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
              Cancel
            </Button>
            <Button onClick={handleChangePassword}>
              Change Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Impersonation Dialog */}
      <Dialog open={openImpersonate} onOpenChange={setOpenImpersonate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate User</DialogTitle>
            <DialogDescription>
              You are about to impersonate {impersonationUser?.username}. This will open a new window with their account.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setOpenImpersonate(false);
                setImpersonationToken('');
                setImpersonationUser(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={openImpersonateWindow}>
              Open in New Window
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Access Level Dialog */}
      <Dialog open={openChangeAccessLevel} onOpenChange={setOpenChangeAccessLevel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Access Level for {selectedUser?.username}</DialogTitle>
            <DialogDescription>
              Select a new access level for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <select
              className="w-full p-2 border rounded-md"
              value={newAccessLevel}
              onChange={(e) => setNewAccessLevel(e.target.value)}
            >
              <option value="user">User</option>
              <option value="moder">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setOpenChangeAccessLevel(false);
                setNewAccessLevel('');
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangeAccessLevel}>
              Update Access Level
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;