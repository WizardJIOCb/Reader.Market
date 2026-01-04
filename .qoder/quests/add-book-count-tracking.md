# Book Count Tracking Design

## Overview

The system currently tracks how many times a book has been added to shelves through the `shelfCount` property. This design addresses the requirement to enhance the display of book shelf count tracking in the user interface, specifically showing "Добавили на полку: 10" (Added to shelf: 10) after the "Добавлено: дата добавления" (Added: date) property in both book cards and shelf displays.

## Current State

The system already has:
- Database table `shelf_books` that tracks associations between books and shelves
- Backend logic in `storage.ts` that calculates shelf count using: `SELECT COUNT(*) as count FROM shelf_books WHERE book_id = ?`
- Frontend display in `BookDetail.tsx` and `BookCard.tsx` showing shelf count as "📚 {book.shelfCount} раз добавили на полки"
- The shelf count is properly calculated as the number of times a book appears across all shelves in the system

## Requirements

### Functional Requirements

1. **Display Enhancement**: The shelf count display should be positioned after the upload date ("Добавлено") information in both book cards and book detail views.

2. **Consistent Labeling**: The shelf count should be displayed with the label "Добавили на полку: [count]" instead of the current "📚 {book.shelfCount} раз добавили на полки".

3. **Universal Application**: The enhanced display should appear consistently in:
   - Book cards on shelves page
   - Book detail page
   - Any other locations where book cards are displayed

### Non-Functional Requirements

1. **Performance**: The shelf count calculation should not significantly impact page load times, leveraging the existing optimized database query.

2. **Data Consistency**: The shelf count should accurately reflect the number of times a book has been added to any shelf across all users.

3. **UI/UX Consistency**: The display format should match the existing design patterns used for other book metadata.

## Architecture

### Data Layer

The shelf count data is derived from the `shelf_books` table which maintains many-to-many relationships between books and shelves. The count is calculated as a SQL aggregation query counting the number of entries in `shelf_books` for each book ID.

### Service Layer

The storage layer (`server/storage.ts`) contains the `getBook` method which executes the shelf count calculation query and includes it in the returned book object as the `shelfCount` property.

### Presentation Layer

The frontend components (`BookCard.tsx`, `BookDetail.tsx`) currently display the shelf count but need to be updated to meet the new positioning and labeling requirements.

## Implementation Strategy

### Backend Considerations

The backend implementation is already complete and does not require changes. The `getBook` method in `storage.ts` already calculates and returns the `shelfCount` property.

### Frontend Changes

The primary changes will be in the UI components to adjust the display positioning and text format:

1. Update the display order in `BookCard.tsx` and `BookDetail.tsx` to position the shelf count after the upload date
2. Modify the text label to use the requested format "Добавили на полку: [count]"
3. Ensure consistent styling with other metadata elements

## Data Model

The system uses the existing `shelf_books` table structure:
- `id`: Primary key
- `shelf_id`: Foreign key to shelves table
- `book_id`: Foreign key to books table
- `added_at`: Timestamp of when the book was added to the shelf

The shelf count is calculated as a COUNT aggregation of records in this table grouped by `book_id`.

## User Interface

### Display Positioning

The shelf count information should appear immediately after the upload date information in the book metadata section. The sequence should be:
1. Publication date (if available)
2. Upload date ("Добавлено")
3. Shelf count ("Добавили на полку: [count]")
4. Other statistics (views, etc.)

### Display Format

The shelf count should be displayed as:
"Добавили на полку: [count]"

Where [count] is the numeric value representing how many times the book has been added to shelves across all users.

## Dependencies

This feature depends on:
- The existing `shelf_books` table for data storage
- The `getBook` method in `storage.ts` for data retrieval
- The existing book display components (`BookCard.tsx`, `BookDetail.tsx`)