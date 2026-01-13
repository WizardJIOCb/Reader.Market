import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AuthPromptProps {
  message?: string;
  variant?: 'inline' | 'card' | 'banner';
  primaryAction?: 'register' | 'login';
  size?: 'small' | 'medium' | 'large';
  returnTo?: string;
}

export const AuthPrompt: React.FC<AuthPromptProps> = ({
  message,
  variant = 'card',
  primaryAction = 'register',
  size = 'medium',
  returnTo
}) => {
  const { t } = useTranslation(['common']);
  
  // Get current URL for return redirect
  const currentUrl = returnTo || (typeof window !== 'undefined' ? window.location.pathname : '/');
  
  // Default messages based on variant and context
  const defaultMessage = t('common:authPromptDefault');
  const displayMessage = message || defaultMessage;
  
  const sizeClasses = {
    small: 'text-sm py-3 px-4',
    medium: 'text-base py-4 px-6',
    large: 'text-lg py-6 px-8'
  };
  
  const buttonSizeClasses = {
    small: 'h-8 px-3 text-xs',
    medium: 'h-10 px-4 text-sm',
    large: 'h-12 px-6 text-base'
  };
  
  const content = (
    <div className={`flex flex-col gap-3 ${sizeClasses[size]}`}>
      <p className="text-center text-muted-foreground">
        {displayMessage}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
        {primaryAction === 'register' ? (
          <>
            <Link href={`/register?returnTo=${encodeURIComponent(currentUrl)}`}>
              <Button className={`w-full sm:w-auto ${buttonSizeClasses[size]}`}>
                <UserPlus className="w-4 h-4 mr-2" />
                {t('common:register')}
              </Button>
            </Link>
            <Link href={`/login?returnTo=${encodeURIComponent(currentUrl)}`}>
              <Button variant="outline" className={`w-full sm:w-auto ${buttonSizeClasses[size]}`}>
                <LogIn className="w-4 h-4 mr-2" />
                {t('common:login')}
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Link href={`/login?returnTo=${encodeURIComponent(currentUrl)}`}>
              <Button className={`w-full sm:w-auto ${buttonSizeClasses[size]}`}>
                <LogIn className="w-4 h-4 mr-2" />
                {t('common:login')}
              </Button>
            </Link>
            <Link href={`/register?returnTo=${encodeURIComponent(currentUrl)}`}>
              <Button variant="outline" className={`w-full sm:w-auto ${buttonSizeClasses[size]}`}>
                <UserPlus className="w-4 h-4 mr-2" />
                {t('common:register')}
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
  
  if (variant === 'card') {
    return (
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          {content}
        </CardContent>
      </Card>
    );
  }
  
  if (variant === 'banner') {
    return (
      <div className="bg-muted/30 rounded-lg border">
        {content}
      </div>
    );
  }
  
  // inline variant
  return (
    <div className="bg-muted/20 rounded-md">
      {content}
    </div>
  );
};
