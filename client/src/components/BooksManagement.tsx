import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminBooksApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { BookEditDialog } from '@/components/BookEditDialog';
import { BookUploadDialog } from '@/components/BookUploadDialog';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  coverImageUrl: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  genre: string;
  publishedYear: number;
  rating: number | null;
  userId: string;
  uploaderUsername: string;
  uploaderFullName: string;
  uploadedAt: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const BooksManagement = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bookToEdit, setBookToEdit] = useState<Book | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { toast } = useToast();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch books when debounced search or pagination changes
  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminBooksApi.getAllBooks({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        sortBy: 'uploadedAt',
        sortOrder: 'desc',
      });

      if (response.ok) {
        const data = await response.json();
        setBooks(data.books);
        setPagination(data.pagination);
      } else {
        throw new Error('Failed to fetch books');
      }
    } catch (error) {
      console.error('Error fetching books:', error);
      toast({
        title: 'Error',
        description: 'Failed to load books',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, toast]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [debouncedSearch]);

  const handleEdit = (book: Book) => {
    setBookToEdit(book);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (book: Book) => {
    setBookToDelete(book);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!bookToDelete) return;

    try {
      const response = await adminBooksApi.deleteBook(bookToDelete.id);

      if (response.ok) {
        toast({
          title: 'Book deleted',
          description: `"${bookToDelete.title}" has been successfully deleted.`,
        });
        setDeleteDialogOpen(false);
        setBookToDelete(null);
        fetchBooks();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete book');
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete book',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Books Management</h2>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add New Book
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Books</CardTitle>
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by title, author, or genre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {debouncedSearch && (
              <Button
                variant="outline"
                onClick={() => setSearch('')}
              >
                Clear
              </Button>
            )}
          </div>
          {debouncedSearch && (
            <p className="text-sm text-muted-foreground mt-2">
              Search results for: "{debouncedSearch}"
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading books...</div>
          ) : books.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {debouncedSearch ? 'No books found matching your search.' : 'No books available.'}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cover</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Genre</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Uploader</TableHead>
                      <TableHead>File Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell>
                          {book.coverImageUrl ? (
                            <a
                              href={`/book/${book.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <img
                                src={book.coverImageUrl}
                                alt={book.title}
                                className="w-10 h-14 object-cover rounded"
                              />
                            </a>
                          ) : (
                            <div className="w-10 h-14 bg-muted rounded flex items-center justify-center text-xs">
                              No cover
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-xs">
                          <a
                            href={`/book/${book.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-primary cursor-pointer block truncate"
                          >
                            {book.title}
                          </a>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{book.author}</TableCell>
                        <TableCell>{book.genre || 'N/A'}</TableCell>
                        <TableCell>{book.publishedYear || 'N/A'}</TableCell>
                        <TableCell>
                          {book.rating ? book.rating.toFixed(1) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`/profile/${book.userId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-primary cursor-pointer"
                          >
                            {book.uploaderFullName || book.uploaderUsername || 'Unknown'}
                          </a>
                        </TableCell>
                        <TableCell>{formatFileSize(book.fileSize)}</TableCell>
                        <TableCell>{formatDate(book.uploadedAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(book)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(book)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} books
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {pagination.page} of {pagination.pages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Book</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{bookToDelete?.title}" by {bookToDelete?.author}?
              <br />
              <br />
              <strong>Warning:</strong> This action will permanently delete the book and all
              associated data including:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Reading progress records</li>
                <li>Bookmarks</li>
                <li>Comments and reviews</li>
                <li>View statistics</li>
              </ul>
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <BookEditDialog
        book={bookToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onBookUpdated={fetchBooks}
      />

      {/* Upload Dialog */}
      <BookUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onBookUploaded={fetchBooks}
      />
    </div>
  );
};

export default BooksManagement;
