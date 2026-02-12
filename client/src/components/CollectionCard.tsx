import React, { useState } from 'react';
import { BookmarkCollection } from '@/types/bookmarkCollections';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  BookOpen, 
  Calendar, 
  Eye,
  Copy,
  Edit,
  Trash2,
  User,
  Star
} from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';

interface CollectionCardProps {
  collection: BookmarkCollection;
  variant?: 'standard' | 'detailed' | 'compact';
  columns?: number; // Number of columns in the grid (1, 2, or 3)
  onDeleteCollection?: (id: string, name: string) => void;
  onCloneCollection?: (collection: BookmarkCollection) => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ 
  collection, 
  variant = 'standard',
  columns,
  onDeleteCollection,
  onCloneCollection
}) => {
  const { t } = useTranslation(['collections', 'common']);
  const { user } = useAuth();

  // Format dates for display in DD.MM.YYYY format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const renderOwnerInfo = () => {
    if (!collection.ownerId || !collection.ownerUsername) return null;
    
    const displayName = collection.ownerFullName || collection.ownerUsername;
    const initials = displayName
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">
          {initials}
        </div>
        <Link 
          href={`/profile/${collection.ownerId}`}
          className="truncate hover:text-primary transition-colors"
        >
          {displayName}
        </Link>
        {collection.ownerProfileRating !== null && collection.ownerProfileRating !== undefined && typeof collection.ownerProfileRating === 'number' && (
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">★</span>
            <span>{collection.ownerProfileRating.toFixed(1)}</span>
          </div>
        )}
        {collection.isClone && (
          <Badge variant="secondary" className="text-xs">
            {t('collections:collectionCard.clone')}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Card className={`${variant === 'compact' ? 'p-3' : 'p-2'} overflow-hidden hover:shadow-lg transition-shadow duration-300`}>
      {variant === 'compact' ? (
        // Compact layout: Color indicator on left, content on right
        <div className="flex flex-col gap-3">
          {/* Top Row: Cover image or Color indicator and Content */}
          <div className="flex gap-3">
            {/* Left: Cover image or Color indicator */}
            <div className="flex-shrink-0">
              {collection.coverImageUrl ? (
                <img 
                  src={
                    collection.coverImageUrl?.startsWith('http')
                      ? collection.coverImageUrl
                      : collection.coverImageUrl
                      ? collection.coverImageUrl.startsWith('/')
                        ? collection.coverImageUrl
                        : `/${collection.coverImageUrl}`
                      : ''}
                  alt={collection.name}
                  className="w-12 h-12 rounded-lg object-cover shadow-sm"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    console.error('Failed to load cover image:', collection.coverImageUrl);
                    // Fallback to color indicator if the cover image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none'; // Hide the broken image
                    const parentDiv = target.parentElement;
                    if (parentDiv) {
                      parentDiv.innerHTML = `
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center shadow-sm"
                          style="background-color: ${collection.color}"
                        >
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                      `;
                    }
                  }}
                />
              ) : (
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: collection.color }}
                >
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            
            {/* Right: Content (Name, Description) */}
            <div className="flex-1 min-w-0">
              <Link href={`/collections/${collection.id}`}>
                <h3 className="font-serif font-bold text-base line-clamp-1">{collection.name}</h3>
              </Link>
              
              <p style={{ paddingTop: '7px' }} className="text-[13px] text-muted-foreground mb-0 line-clamp-3">
                {collection.description || t('collections:collectionCard.noDescription')}
              </p>
            </div>
          </div>
          
          {/* Stats row */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground ml-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5">
                  <BookOpen className="w-3 h-3" /> {collection.bookCount || 0} {t('collections:collectionCard.books')}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections:collectionCard.bookCount')}</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5">
                  <Eye className="w-3 h-3" /> {collection.viewCount || 0} {t('collections:collectionCard.views')}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections:collectionCard.viewCount')}</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5">
                  📌 {collection.bookmarkCount || 0} {t('collections:collectionCard.bookmarks')}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections:collectionCard.bookmarkCount')}</p>
              </TooltipContent>
            </Tooltip>
            
            {collection.isPublic ? (
              <Badge variant="outline" className="text-xs whitespace-nowrap bg-green-50 border-green-200 text-green-700">
                {t('collections:collectionCard.public')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs whitespace-nowrap bg-gray-100 border-gray-300 text-gray-600">
                {t('collections:collectionCard.private')}
              </Badge>
            )}
          </div>
          
          {/* Owner info */}
          {renderOwnerInfo()}
          
          {/* Creation date */}
          <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
            <Calendar className="w-3 h-3 mr-1" />
            <span>{t('collections:collectionCard.created')}: {formatDate(collection.createdAt)}</span>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              asChild 
              size="sm" 
              variant="outline" 
              className="text-xs flex-1"
            >
              <Link href={`/collections/${collection.id}`}>
                <Eye className="w-4 h-4 mr-2" />
                {t('collections:collectionCard.view')}
              </Link>
            </Button>
            
            {collection.isOwn && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs"
                  onClick={() => onCloneCollection?.(collection)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href={`/collections/${collection.id}/edit`}>
                    <Edit className="w-4 h-4" />
                  </Link>
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs"
                  onClick={() => onDeleteCollection?.(collection.id, collection.name)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {!collection.isOwn && (
              <Button 
                size="sm" 
                variant="outline"
                className="text-xs"
                onClick={() => onCloneCollection?.(collection)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Standard layout
        <>
          <Link href={`/collections/${collection.id}`}>
            <div className="relative">
              {collection.coverImageUrl ? (
                <img 
                  src={
                    collection.coverImageUrl?.startsWith('http')
                      ? collection.coverImageUrl
                      : collection.coverImageUrl
                      ? collection.coverImageUrl.startsWith('/')
                        ? collection.coverImageUrl
                        : `/${collection.coverImageUrl}`
                      : ''}
                  alt={collection.name}
                  className="w-full rounded-t-lg object-cover aspect-[2/3] hover:opacity-90 transition-opacity"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    console.error('Failed to load cover image:', collection.coverImageUrl);
                    // Fallback to color indicator if the cover image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none'; // Hide the broken image
                    const parentDiv = target.parentElement;
                    if (parentDiv) {
                      parentDiv.innerHTML = `
                        <div 
                          className="w-full rounded-t-lg flex items-center justify-center aspect-[2/3] hover:opacity-90 transition-opacity"
                          style="background-color: ${collection.color}"
                        >
                          <BookOpen className="w-12 h-12 text-white" />
                        </div>
                      `;
                    }
                  }}
                />
              ) : (
                <div 
                  className="w-full rounded-t-lg flex items-center justify-center aspect-[2/3] hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: collection.color }}
                >
                  <BookOpen className="w-12 h-12 text-white" />
                </div>
              )}
              
              {(collection.bookmarkCount !== undefined && collection.bookmarkCount > 0) && (
                <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-sm font-bold">
                  📌 {collection.bookmarkCount}
                </div>
              )}
            </div>
          </Link>
          
          <CardHeader className="pb-1">
            <h3 className="font-serif font-bold text-lg line-clamp-2">{collection.name}</h3>
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              <User className="w-4 h-4" />
              {collection.ownerUsername || user?.username}
            </p>
          </CardHeader>
          
          <CardContent className="pb-1">
            {variant === 'detailed' && (
              <>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                  {collection.description || t('collections:collectionCard.noDescription')}
                </p>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    {collection.bookCount || 0} {t('collections:collectionCard.books')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    📌 {collection.bookmarkCount || 0} {t('collections:collectionCard.bookmarks')}
                  </Badge>
                  {collection.isPublic ? (
                    <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                      {t('collections:collectionCard.public')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-gray-100 border-gray-300 text-gray-600">
                      {t('collections:collectionCard.private')}
                    </Badge>
                  )}
                </div>
              </>
            )}
            
            {/* Collection stats */}
            <div className="space-y-1 mb-2">
              <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                <BookOpen className="w-3 h-3 mr-1" />
                <span>{t('collections:collectionCard.books')}: {collection.bookCount || 0}</span>
              </div>
              
              <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                <Eye className="w-3 h-3 mr-1" />
                <span>{t('collections:collectionCard.views')}: {collection.viewCount || 0}</span>
              </div>
              
              <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                <span>📌 {t('collections:collectionCard.bookmarks')}: {collection.bookmarkCount || 0}</span>
              </div>
              
              <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                <Calendar className="w-3 h-3 mr-1" />
                <span>{t('collections:collectionCard.created')}: {formatDate(collection.createdAt)}</span>
              </div>
              
              {collection.updatedAt !== collection.createdAt && (
                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{t('collections:collectionCard.updated')}: {formatDate(collection.updatedAt)}</span>
                </div>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-2">
            <div className="flex gap-2 w-full">
              <Button asChild size="sm" className="flex-1">
                <Link href={`/collections/${collection.id}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  {t('collections:collectionCard.view')}
                </Link>
              </Button>
              
              {collection.isOwn && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onCloneCollection?.(collection)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/collections/${collection.id}/edit`}>
                      <Edit className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onDeleteCollection?.(collection.id, collection.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              
              {!collection.isOwn && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onCloneCollection?.(collection)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  );
};

export default CollectionCard;