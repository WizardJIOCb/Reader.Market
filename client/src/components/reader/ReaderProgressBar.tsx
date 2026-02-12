/**
 * ReaderProgressBar - Progress indicator for reading
 * 
 * Shows:
 * - Overall reading progress
 * - Chapter markers
 * - Active readers positions (for social features)
 */

import React from 'react';
import { BookContent, Position, ActiveReader } from './types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ReaderProgressBarProps {
  content: BookContent | null;
  position: Position | null;
  activeReaders?: ActiveReader[];
  onSeek?: (percentage: number) => void;
  className?: string;
}

export function ReaderProgressBar({
  content,
  position,
  activeReaders = [],
  onSeek,
  className = '',
}: ReaderProgressBarProps) {
  const percentage = position?.percentage || 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newPercentage = (x / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, newPercentage)));
  };

  // Calculate chapter positions for markers
  const chapterMarkers = content?.chapters.map((chapter, index) => {
    const startPercentage = (chapter.startOffset / (content.totalChars || 1)) * 100;
    return {
      index,
      title: chapter.title,
      percentage: startPercentage,
    };
  }) || [];

  return (
    <TooltipProvider>
      <div className={`relative ${className}`}>
        {/* Progress bar container */}
        <div
          className="relative h-2 bg-muted rounded-full cursor-pointer overflow-visible"
          onClick={handleClick}
        >
          {/* Chapter markers */}
          {chapterMarkers.length > 1 && chapterMarkers.map((marker) => (
            <Tooltip key={marker.index}>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-0 w-0.5 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60 transition-colors"
                  style={{ left: `${marker.percentage}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{marker.title}</p>
                <p className="text-muted-foreground">Глава {marker.index + 1}</p>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 h-full bg-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />

          {/* Current position indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-orange-600 rounded-full shadow-md border-2 border-background transition-all duration-300"
            style={{ left: `calc(${percentage}% - 8px)` }}
          />

          {/* Active readers markers */}
          {activeReaders.map((reader) => (
            <Tooltip key={reader.userId}>
              <TooltipTrigger asChild>
                <div
                  className="absolute -top-3 transition-all duration-500"
                  style={{ left: `calc(${reader.position.percentage}% - 12px)` }}
                >
                  <Avatar className="w-6 h-6 border-2 border-background shadow-sm">
                    <AvatarImage src={reader.avatarUrl} alt={reader.username} />
                    <AvatarFallback className="text-[10px]">
                      {reader.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{reader.username}</p>
                <p className="text-muted-foreground">
                  {Math.round(reader.position.percentage)}% прочитано
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Percentage text */}
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>0%</span>
          <span className="font-medium">{Math.round(percentage)}%</span>
          <span>100%</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * Compact progress bar for header/footer
 */
interface CompactProgressBarProps {
  percentage: number;
  className?: string;
}

export function CompactProgressBar({ percentage, className = '' }: CompactProgressBarProps) {
  return (
    <div className={`h-1 bg-muted rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-orange-500 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/**
 * Circular progress indicator
 */
interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CircularProgress({
  percentage,
  size = 40,
  strokeWidth = 4,
  className = '',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-orange-500 transition-all duration-300"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

export default ReaderProgressBar;
