import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

interface UserProfileDisplayProps {
  userId: string;
  username: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  profileRating?: number | null;
  bookRating?: number | null; // Additional book rating if needed
  showProfileLink?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserProfileDisplay({
  userId,
  username,
  fullName,
  avatarUrl,
  profileRating,
  bookRating,
  showProfileLink = true,
  size = 'md',
  className = ''
}: UserProfileDisplayProps) {
  const displayName = fullName || username;
  const initials = displayName
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .join('');

  // Size configurations
  const sizeClasses = {
    sm: { avatar: 'w-6 h-6', text: 'text-sm', rating: 'text-xs' },
    md: { avatar: 'w-8 h-8', text: 'text-base', rating: 'text-sm' },
    lg: { avatar: 'w-10 h-10', text: 'text-lg', rating: 'text-base' }
  };

  const sizes = sizeClasses[size];

  // Get rating variant and color classes (same as UserNameWithRating)
  const getRatingVariant = (rating: number | null) => {
    if (rating === null) return 'secondary';
    if (rating >= 8) return 'default';
    if (rating >= 5) return 'secondary';
    return 'destructive';
  };
  
  const getRatingColorClass = (rating: number | null) => {
    if (rating === null) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (rating >= 8) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (rating >= 5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  };

  const renderContent = () => (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Avatar */}
      <Avatar className={sizes.avatar}>
        <AvatarImage src={avatarUrl || ''} alt={displayName} />
        <AvatarFallback className={sizes.rating}>{initials}</AvatarFallback>
      </Avatar>

      {/* Profile Rating (using Badge like in comments) */}
      {profileRating !== null && profileRating !== undefined && (
        (() => {
          // Convert string rating to number if needed
          const numericRating = typeof profileRating === 'string' ? parseFloat(profileRating) : profileRating;
          if (typeof numericRating === 'number' && !isNaN(numericRating)) {
            return (
              <Badge 
                variant={getRatingVariant(numericRating) as any} 
                className={`text-xs h-5 flex items-center gap-1 ${getRatingColorClass(numericRating)}`}
              >
                <Star className="w-3 h-3" />
                {numericRating % 1 === 0 ? numericRating : numericRating.toFixed(1)}
              </Badge>
            );
          }
          return null;
        })()
      )}

      {/* Username */}
      <span className={`font-medium ${sizes.text}`}>
        {displayName}
      </span>

      {/* Book Rating (if provided) */}
      {bookRating !== null && bookRating !== undefined && typeof bookRating === 'number' && (
        <div className={`flex items-center gap-1 ${sizes.rating} ml-2`}>
          <span className="text-blue-500">📚</span>
          <span className="font-medium">{bookRating.toFixed(1)}</span>
        </div>
      )}
    </div>
  );

  // Wrap with link if needed
  if (showProfileLink) {
    return (
      <Link 
        href={`/profile/${userId}`}
        className="hover:text-primary transition-colors"
      >
        {renderContent()}
      </Link>
    );
  }

  return renderContent();
}