import React, { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Star } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';

interface UserNameWithRatingProps {
  userId: string;
  username: string;
  fullName?: string | null;
  profileRating?: number | null;
  showRating?: boolean;
  className?: string;
  onProfileClick?: (userId: string) => void;
}

export function UserNameWithRating({
  userId,
  username,
  fullName,
  profileRating: initialProfileRating,
  showRating = true,
  className = '',
  onProfileClick
}: UserNameWithRatingProps) {
  const displayName = fullName || username;
  
  const { profile: userProfile, loading: profileLoading } = useUserProfile(userId);
  
  // Use provided rating or fetched rating
  const effectiveRating = initialProfileRating ?? userProfile?.profileRating;
  const ratingCount = userProfile?.ratingCount || 0;
  
  const { t } = useTranslation(['common', 'profile']);
  
  const getRatingVariant = (rating: number | null) => {
    if (rating === null) return 'secondary';
    if (rating >= 8) return 'default';
    if (rating >= 5) return 'secondary';
    return 'destructive';
  };
  
  // Get color classes for consistent styling
  const getRatingColorClass = (rating: number | null) => {
    if (rating === null) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (rating >= 8) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (rating >= 5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onProfileClick) {
      onProfileClick(userId);
    } else {
      window.open(`/profile/${username}`, '_blank');
    }
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {showRating && effectiveRating !== undefined && effectiveRating !== null && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant={getRatingVariant(effectiveRating) as any} 
                className={`text-xs h-5 flex items-center gap-1 cursor-help ${getRatingColorClass(effectiveRating)}`}
              >
                <Star className="w-3 h-3" />
                {effectiveRating % 1 === 0 ? effectiveRating : effectiveRating.toFixed(1)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="bg-[#fbf6f0] dark:bg-[#2a2520] border border-[#e8e0d0] dark:border-[#3a3530] text-[#2a2520] dark:text-[#fbf6f0]">
              <div className="text-center">
                <p className="font-medium">{t('profile:userRating', 'User Rating')}</p>
                <p className="text-xs text-[#5a5550] dark:text-[#cbc6c0]">
                  {ratingCount > 0 
                    ? t('profile:ratingCountInfo', '{{count}} ratings', { count: ratingCount })
                    : t('profile:noRatingsYet', 'No ratings yet')
                  }
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {showRating && profileLoading && (
        <Badge variant="secondary" className="text-xs h-5">
          ...
        </Badge>
      )}
      
      <button
        onClick={handleClick}
        className="font-medium hover:underline text-left text-sm sm:text-base"
      >
        {displayName}
      </button>
    </div>
  );
}