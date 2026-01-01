import React, { useState } from 'react';
import { loadFB2File } from './fb2Parser';
import { paginateContent } from './paginationUtils';

export function TestComponent() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [paginationResult, setPaginationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testFB2Parsing = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPaginationResult(null);
    
    try {
      // Test with the FB2 file we know exists
      const testData = await loadFB2File('/uploads/bookFile-1766339282563-965612108.fb2');
      setResult(testData);
      
      // Test pagination with sample content
      if (testData.chapters.length > 0) {
        const combinedContent = testData.chapters.map(chapter => `
          <h2>${chapter.title}</h2>
          ${chapter.content}
        `).join('\n');
        
        // Paginate with a small height for testing
        const pages = paginateContent(combinedContent, 300);
        setPaginationResult({
          pages,
          pageCount: pages.length
        });
      }
    } catch (err) {
      console.error('Test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Book Reader Test</h1>
      <button 
        onClick={testFB2Parsing}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Book Reading'}
      </button>
      
      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-800 rounded">
          <h2 className="font-bold">Error:</h2>
          <p>{error}</p>
        </div>
      )}
      
      {result && (
        <div className="mt-4 p-4 bg-green-100 text-green-800 rounded">
          <h2 className="font-bold">FB2 Parsing Success!</h2>
          <p>Metadata: {result.metadata.title} by {result.metadata.author}</p>
          <p>Chapters found: {result.chapters.length}</p>
          {result.chapters.slice(0, 3).map((chapter: any, index: number) => (
            <div key={index} className="mt-2 p-2 bg-white rounded">
              <h3 className="font-bold">Chapter {chapter.id}: {chapter.title}</h3>
              <p className="text-sm truncate">{chapter.content.substring(0, 100)}...</p>
            </div>
          ))}
        </div>
      )}
      
      {paginationResult && (
        <div className="mt-4 p-4 bg-blue-100 text-blue-800 rounded">
          <h2 className="font-bold">Pagination Test Results:</h2>
          <p>Pages created: {paginationResult.pageCount}</p>
          {paginationResult.pages.slice(0, 2).map((page: string, index: number) => (
            <div key={index} className="mt-2 p-2 bg-white rounded max-h-32 overflow-hidden">
              <h3 className="font-bold">Page {index + 1}:</h3>
              <div className="text-sm" dangerouslySetInnerHTML={{ __html: page }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}