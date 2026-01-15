/**
 * ReaderToolbar - Top toolbar for reader page
 * 
 * Contains: back button, navigation, and action buttons for side panel
 */

import React from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  Bookmark,
  Brain,
  MessageCircle,
  Settings,
  List,
} from 'lucide-react';
import { BookContent, Chapter, Position } from './types';
import { ReaderSettings as ReaderSettingsType } from './types';

interface ReaderToolbarProps {
  book: {
    id: string;
    title: string;
    author: string;
  };
  content: BookContent | null;
  currentChapter: Chapter | null;
  position: Position | null;
  // Chapter progress
  currentPageInChapter?: number;
  totalPagesInChapter?: number;
  // Overall book progress
  overallPercentage?: number;
  currentPageOverall?: number;
  totalPagesOverall?: number;
  settings: ReaderSettingsType;
  onPrevPage: () => void;
  onNextPage: () => void;
  // Panel open handlers
  onOpenToc: () => void;
  onOpenSearch: () => void;
  onOpenBookmarks: () => void;
  onOpenSettings: () => void;
  onOpenAI: () => void;
  onOpenChat: () => void;
  // Active states
  isTocOpen?: boolean;
  isSearchOpen?: boolean;
  isBookmarksOpen?: boolean;
  isSettingsOpen?: boolean;
  isAIOpen?: boolean;
  isChatOpen?: boolean;
  unreadChatCount?: number;
}

export function ReaderToolbar({
  book,
  content,
  currentChapter,
  position,
  currentPageInChapter = 1,
  totalPagesInChapter = 1,
  overallPercentage = 0,
  currentPageOverall = 1,
  totalPagesOverall = 1,
  settings,
  onPrevPage,
  onNextPage,
  onOpenToc,
  onOpenSearch,
  onOpenBookmarks,
  onOpenSettings,
  onOpenAI,
  onOpenChat,
  isTocOpen = false,
  isSearchOpen = false,
  isBookmarksOpen = false,
  isSettingsOpen = false,
  isAIOpen = false,
  isChatOpen = false,
  unreadChatCount = 0,
}: ReaderToolbarProps) {
  const { t } = useTranslation();
  const chapterNumber = currentChapter ? currentChapter.index + 1 : 1;
  const totalChapters = content?.chapters.length || 1;

  return (
    <div className="bg-card border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        {/* Mobile layout: 2 rows */}
        <div className="sm:hidden">
          {/* Row 1: Back button + Book title (left) + Action buttons (right) */}
          <div className="flex items-center justify-between h-10 gap-1">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Link href={`/book/${book.id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <Link href={`/book/${book.id}`} className="min-w-0 flex-1">
                <span className="text-sm font-medium truncate block">{book.title}</span>
              </Link>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button
                variant={isTocOpen ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={onOpenToc}
                title="Содержание"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={isBookmarksOpen ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={onOpenBookmarks}
                title="Закладки"
              >
                <Bookmark className="w-4 h-4" />
              </Button>
              <Button
                variant={isSearchOpen ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={onOpenSearch}
                title="Поиск"
              >
                <Search className="w-4 h-4" />
              </Button>
              <Button
                variant={isAIOpen ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={onOpenAI}
                title="AI Анализ"
              >
                <Brain className="w-4 h-4" />
              </Button>
              <Button
                variant={isChatOpen ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8 relative"
                onClick={onOpenChat}
                title="Чат книги"
              >
                <MessageCircle className="w-4 h-4" />
                {unreadChatCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[8px] font-medium rounded-full w-3 h-3 flex items-center justify-center">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </Button>
              <Button
                variant={isSettingsOpen ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={onOpenSettings}
                title="Настройки"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Row 2: Progress with navigation arrows (centered) */}
          <div className="flex items-center justify-center h-10 gap-1 border-t">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPrevPage}
              title="Предыдущая страница"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="text-xs text-muted-foreground text-center leading-tight">
              <div className="font-medium">
                {Math.round(overallPercentage)}% {t('reader.progressBook')} {currentPageOverall}/{totalPagesOverall}
              </div>
              <div className="text-[10px] opacity-75">
                {t('reader.progressChapter')} {chapterNumber}/{totalChapters}, {t('reader.progressPage')} {currentPageInChapter}/{totalPagesInChapter}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNextPage}
              title="Следующая страница"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Desktop layout: single row */}
        <div className="hidden sm:flex items-center justify-between h-14 gap-2">
          {/* Left section: Back + Book info */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink">
            <Link href={`/book/${book.id}`}>
              <Button variant="ghost" size="icon" className="flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            
            <Link href={`/book/${book.id}`} className="min-w-0 hidden sm:block hover:opacity-80 transition-opacity cursor-pointer">
              <h1 className="text-sm font-medium truncate">{book.title}</h1>
              <p className="text-xs text-muted-foreground truncate">{book.author}</p>
            </Link>
          </div>

          {/* Center section: Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevPage}
              title="Предыдущая страница"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            {/* Progress indicator */}
            <div className="text-xs text-muted-foreground min-w-[160px] text-center leading-tight">
              <div className="font-medium">
                {Math.round(overallPercentage)}% {t('reader.progressBook')} {currentPageOverall}/{totalPagesOverall}
              </div>
              {/* Chapter info with chapter-specific page */}
              <div className="text-[10px] opacity-75">
                {t('reader.progressChapter')} {chapterNumber} {t('reader.progressOf')} {totalChapters}, {t('reader.progressPage')} {currentPageInChapter}/{totalPagesInChapter}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onNextPage}
              title="Следующая страница"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Right section: Actions */}
          <div className="flex items-center gap-1">
            {/* Table of Contents */}
            <Button
              variant={isTocOpen ? 'default' : 'ghost'}
              size="icon"
              onClick={onOpenToc}
              title="Содержание"
            >
              <List className="w-5 h-5" />
            </Button>

            {/* Bookmarks */}
            <Button
              variant={isBookmarksOpen ? 'default' : 'ghost'}
              size="icon"
              onClick={onOpenBookmarks}
              title="Закладки"
            >
              <Bookmark className="w-5 h-5" />
            </Button>

            {/* Search */}
            <Button
              variant={isSearchOpen ? 'default' : 'ghost'}
              size="icon"
              onClick={onOpenSearch}
              title="Поиск"
            >
              <Search className="w-5 h-5" />
            </Button>

            {/* AI */}
            <Button
              variant={isAIOpen ? 'default' : 'ghost'}
              size="icon"
              onClick={onOpenAI}
              title="AI Анализ"
            >
              <Brain className="w-5 h-5" />
            </Button>

            {/* Chat */}
            <Button
              variant={isChatOpen ? 'default' : 'ghost'}
              size="icon"
              onClick={onOpenChat}
              title="Чат книги"
              className="relative"
            >
              <MessageCircle className="w-5 h-5" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </Button>

            {/* Settings */}
            <Button
              variant={isSettingsOpen ? 'default' : 'ghost'}
              size="icon"
              onClick={onOpenSettings}
              title="Настройки"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {settings.showProgressBar !== false && (
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default ReaderToolbar;
