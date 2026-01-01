# Enhanced Ebook Reader Component

This directory contains the enhanced ebook reader implementation for the Ollama-Reader application, using Foliate.js as the core rendering engine.

## Components

### EnhancedBookReader.tsx
The main React component that provides the UI for the ebook reader. It includes:
- Navigation controls (previous/next page)
- Font size adjustment
- Bookmark management
- View mode switching (paginated/scroll)
- Loading and error states

### readerService.ts
A service layer that handles communication between React components and Foliate.js:
- Reader initialization and lifecycle management
- Navigation and location tracking
- Settings management (font size, theme, etc.)
- Bookmark handling
- Text search functionality

### AIAnalysisAdapter.ts
An adapter that connects the reader to AI analysis features:
- Text selection analysis
- Content summarization
- Key point extraction
- Term explanation in context

## Features

1. **Multi-format Support**: EPUB, MOBI, AZW3, FB2, CBZ, and experimental PDF
2. **Advanced Pagination**: Proper page breaking and text wrapping
3. **Customization Options**: Adjustable font size, line spacing, margins
4. **Bookmark Management**: Add, remove, and navigate to bookmarks
5. **AI Integration**: Analyze selected text with Ollama
6. **Responsive Design**: Works on desktop and mobile devices
7. **Performance Optimized**: Efficient rendering without loading entire books into memory

## Usage

```tsx
import { EnhancedBookReader } from '@/components/ebook-reader/EnhancedBookReader';

function ReaderPage() {
  return (
    <EnhancedBookReader
      bookId="123"
      bookUrl="/books/sample.epub"
      fileType="epub"
      onProgressUpdate={(progress) => console.log('Progress:', progress)}
      onBookmarkAdded={(bookmark) => console.log('Bookmark added:', bookmark)}
      onTextSelected={(text) => console.log('Text selected:', text)}
      onNext={() => console.log('Next page')}
      onPrev={() => console.log('Previous page')}
      hasPrev={true}
      hasNext={true}
    />
  );
}
```

## Dependencies

- [Foliate.js](https://github.com/johnfactotum/foliate-js) - Core ebook rendering engine
- React and related libraries
- Tailwind CSS for styling
- Lucide React for icons

## Architecture

The component follows a layered architecture:
1. **UI Layer**: React components for presentation
2. **Service Layer**: readerService.ts for business logic
3. **AI Layer**: AIAnalysisAdapter.ts for AI integration
4. **Core Engine**: Foliate.js for ebook rendering

This separation allows for easier maintenance, testing, and future enhancements.