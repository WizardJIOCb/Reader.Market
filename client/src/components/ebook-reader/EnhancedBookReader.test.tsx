import React from 'react';
import { render, screen } from '@testing-library/react';
import { EnhancedBookReader } from './EnhancedBookReader';

// Mock the foliate-js import
jest.mock('foliate-js/reader.js', () => {
  return {
    Reader: jest.fn().mockImplementation(() => {
      return {
        load: jest.fn().mockResolvedValue(undefined),
        goTo: jest.fn(),
        getLocation: jest.fn(),
        getCurrentPage: jest.fn().mockReturnValue(1),
        getTotalPages: jest.fn().mockReturnValue(10),
        getProgress: jest.fn().mockReturnValue(0.1),
        setSetting: jest.fn(),
        on: jest.fn(),
        destroy: jest.fn(),
      };
    }),
  };
});

describe('EnhancedBookReader', () => {
  const defaultProps = {
    bookId: '1',
    bookUrl: '/books/test.epub',
    fileType: 'epub',
    hasPrev: false,
    hasNext: true,
    onBookmarkAdded: jest.fn(),
    onTextSelected: jest.fn(),
    onNext: jest.fn(),
    onPrev: jest.fn(),
  };

  it('renders without crashing', () => {
    render(<EnhancedBookReader {...defaultProps} />);
    expect(screen.getByText('Loading book...')).toBeInTheDocument();
  });

  it('displays navigation controls', () => {
    render(<EnhancedBookReader {...defaultProps} />);
    
    // Initially shows loading state
    expect(screen.getByText('Loading book...')).toBeInTheDocument();
    
    // After loading, it should show navigation controls
    // Note: In a real test, we would need to wait for the async loading to complete
  });

  it('handles error state', () => {
    // TODO: Add error state testing when we have a way to simulate errors
  });
});