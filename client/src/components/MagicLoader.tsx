import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BookPlus } from 'lucide-react';

interface Book {
  id: string;
  title: string;
  authors: string[];
  description?: string;
  coverUrl?: string;
  downloadUrl?: string;
  language: string;
  source: string;
  genre?: string;
  publishedYear?: number | null;
  firstPublishYear?: number | null;
}

const MagicLoader: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'title' | 'author'>('title');
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ru'>('en');
  const [publicDomainOnly, setPublicDomainOnly] = useState(true);

  const searchGutendex = async (): Promise<Book[]> => {
    try {
      let url = `https://gutendex.com/books?languages=${selectedLanguage}&page_size=20`;
      if (publicDomainOnly) {
        url += `&copyright=false`;
      }
      if (searchType === 'title') {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      } else {
        url += `&author_name=${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      return data.results?.map((book: any) => ({
        id: book.id.toString(),
        title: book.title,
        authors: book.authors?.map((author: any) => author.name) || [],
        description: book.subjects?.join(', '),
        coverUrl: book.formats?.['image/jpeg'] || book.formats?.['image/png'],
        downloadUrl: book.formats?.['application/fb2'] || book.formats?.['text/plain'] || book.formats?.['application/pdf'],
        publishedYear: book.first_publish_year || null,
        genre: book.subjects?.join(', ') || '',
        language: selectedLanguage,
        source: 'Gutendex'
      })) || [];
    } catch (error) {
      console.error('Error fetching from Gutendex:', error);
      return [];
    }
  };

  const searchOpenLibrary = async (): Promise<Book[]> => {
    try {
      let url = 'https://openlibrary.org/search.json?limit=20';
      if (searchType === 'title') {
        url += `&title=${encodeURIComponent(searchQuery)}`;
      } else {
        url += `&author=${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      return data.docs?.map((book: any) => ({
        id: book.key?.split('/').pop(),
        title: book.title,
        authors: book.author_name || [],
        description: book.subject?.slice(0, 3)?.join(', '),
        coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : undefined,
        downloadUrl: book.access ? book.access.pdf?.url || book.access.epub?.url || undefined : undefined,
        publishedYear: book.first_publish_year || book.publish_year?.[0] || null,
        genre: book.subject?.slice(0, 3)?.join(', ') || '',
        language: selectedLanguage,
        source: 'Open Library'
      })) || [];
    } catch (error) {
      console.error('Error fetching from Open Library:', error);
      return [];
    }
  };

  const searchGoogleBooks = async (): Promise<Book[]> => {
    try {
      let query = '';
      if (searchType === 'title') {
        query = `intitle:${encodeURIComponent(searchQuery)}`;
      } else {
        query = `inauthor:${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${query}&langRestrict=${selectedLanguage}&maxResults=20&printType=books&filter=free-ebooks`
      );
      const data = await response.json();
      
      return data.items?.map((item: any) => ({
        id: item.id,
        title: item.volumeInfo.title,
        authors: item.volumeInfo.authors || [],
        description: item.volumeInfo.description,
        coverUrl: item.volumeInfo.imageLinks?.thumbnail,
        downloadUrl: item.accessInfo.pdf?.downloadLink || item.accessInfo.epub?.downloadLink,
        publishedYear: item.volumeInfo.publishedDate ? parseInt(item.volumeInfo.publishedDate.substring(0, 4)) : null,
        genre: item.volumeInfo.categories?.join(', ') || '',
        language: selectedLanguage,
        source: 'Google Books'
      })) || [];
    } catch (error) {
      console.error('Error fetching from Google Books:', error);
      return [];
    }
  };

  const searchInternetArchive = async (): Promise<Book[]> => {
    try {
      let query = `language:${selectedLanguage.toUpperCase()} AND mediatype:texts AND `;
      if (searchType === 'title') {
        query += `title:${encodeURIComponent(searchQuery)}`;
      } else {
        query += `creator:${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await fetch(
        `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier,title,creator,description,publisher,date&output=json&rows=20`
      );
      const data = await response.json();
      
      return data.response?.docs?.map((book: any) => ({
        id: book.identifier,
        title: book.title,
        authors: book.creator || [],
        description: book.description?.length > 100 ? `${book.description.substring(0, 100)}...` : book.description,
        coverUrl: `https://archive.org/services/img/${book.identifier}`,
        downloadUrl: `https://archive.org/download/${book.identifier}/${book.identifier}_djvu.txt`, // Default to txt, but could be expanded
        publishedYear: book.date ? parseInt(book.date.substring(0, 4)) : null,
        genre: book.publisher?.join(', ') || '',
        language: selectedLanguage,
        source: 'Internet Archive'
      })) || [];
    } catch (error) {
      console.error('Error fetching from Internet Archive:', error);
      return [];
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setResults([]);
    
    try {
      // Run all searches in parallel
      const [gutendexResults, openLibraryResults, googleBooksResults, internetArchiveResults] = await Promise.all([
        searchGutendex(),
        searchOpenLibrary(),
        searchGoogleBooks(),
        searchInternetArchive()
      ]);
      
      // Combine all results
      const allResults = [
        ...gutendexResults,
        ...openLibraryResults,
        ...googleBooksResults,
        ...internetArchiveResults
      ];
      
      // Remove duplicates based on title and author
      const uniqueResults = allResults.filter((book, index, self) =>
        index === self.findIndex(b => 
          b.title.toLowerCase() === book.title.toLowerCase() &&
          b.authors.join(', ').toLowerCase() === book.authors.join(', ').toLowerCase()
        )
      );
      
      setResults(uniqueResults);
    } catch (error) {
      console.error('Error during search:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (book: Book) => {
    // Here we would call our backend API to add the book to our database
    try {
      const response = await fetch('/api/admin/books', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: book.title,
          authors: book.authors,
          description: book.description,
          language: book.language,
          source: book.source,
          externalId: book.id,
          externalSource: book.source,
          coverUrl: book.coverUrl,
          downloadUrl: book.downloadUrl,
          genre: book.genre || '',
          publishedYear: book.publishedYear || null
        })
      });

      if (response.ok) {
        alert(`Book "${book.title}" added successfully!`);
      } else {
        alert(`Failed to add book: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error adding book:', error);
      alert('Error adding book');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookPlus className="w-5 h-5" />
            Magic Loader / Волшебный Загрузчик
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Enter book title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? 'Searching...' : 'Search / Поиск'}
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <label htmlFor="search-type">Search by:</label>
                <select
                  id="search-type"
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as 'title' | 'author')}
                  className="border rounded p-2"
                >
                  <option value="title">Title / Название</option>
                  <option value="author">Author / Автор</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label htmlFor="language">Language:</label>
                <select
                  id="language"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'ru')}
                  className="border rounded p-2"
                >
                  <option value="en">English</option>
                  <option value="ru">Russian / Русский</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label htmlFor="public-domain">Public Domain Only:</label>
                <input
                  id="public-domain"
                  type="checkbox"
                  checked={publicDomainOnly}
                  onChange={(e) => setPublicDomainOnly(e.target.checked)}
                  className="border rounded"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Search Results / Результаты поиска ({results.length})</h2>
          
          <div className="space-y-4">
            {results.map((book) => (
              <Card key={`${book.source}-${book.id}`} className="p-4">
                <div className="flex gap-4">
                  {book.coverUrl && (
                    <img 
                      src={book.coverUrl} 
                      alt={book.title} 
                      className="w-16 h-24 object-cover rounded"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg">{book.title}</h3>
                        <p className="text-sm text-gray-600">
                          {book.authors.length > 0 ? book.authors.join(', ') : 'Unknown Author / Неизвестный автор'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">
                          {book.source}
                        </Badge>
                        <Badge variant="outline">
                          {book.language === 'en' ? 'English' : 'Russian / Русский'}
                        </Badge>
                      </div>
                    </div>
                    
                    {book.description && (
                      <p className="mt-2 text-sm text-gray-700">
                        {book.description}
                      </p>
                    )}
                    
                    <div className="mt-3 flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(book.downloadUrl || `https://${book.source.toLowerCase().replace(' ', '')}.org`, '_blank')}
                      >
                        Preview / Предпросмотр
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handleAddBook(book)}
                      >
                        Add to Library / Добавить
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MagicLoader;