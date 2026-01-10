import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Language configuration with flag indicators using colored circles
const LANGUAGES = [
  { 
    code: 'en', 
    icon: (
      <div className="relative w-5 h-5 rounded-sm border border-gray-300 overflow-hidden flex-shrink-0" style={{ backgroundColor: '#B22234' }}>
        <div className="absolute top-0 left-0 w-full h-full flex flex-col">
          <div className="w-full flex-1 bg-[#B22234]"></div>
          <div className="w-full flex-1 bg-white"></div>
          <div className="w-full flex-1 bg-[#B22234]"></div>
          <div className="w-full flex-1 bg-white"></div>
          <div className="w-full flex-1 bg-[#B22234]"></div>
          <div className="w-full flex-1 bg-white"></div>
          <div className="w-full flex-1 bg-[#B22234]"></div>
        </div>
        <div className="absolute top-0 left-0 w-[45%] h-[55%] bg-[#3C3B6E]"></div>
      </div>
    ),
    name: 'English' 
  },
  { 
    code: 'ru', 
    icon: (
      <div className="flex flex-col w-5 h-5 rounded-sm border border-gray-300 overflow-hidden flex-shrink-0">
        <div className="h-1/3 bg-white"></div>
        <div className="h-1/3 bg-[#0039A6]"></div>
        <div className="h-1/3 bg-[#D52B1E]"></div>
      </div>
    ),
    name: 'Русский' 
  },
] as const;

interface LanguageSwitcherProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export function LanguageSwitcher({ variant = 'icon', className = '' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation('navigation');
  const { user, refreshUser } = useAuth();
  
  const currentLanguage = LANGUAGES.find(lang => lang.code === i18n.language) || LANGUAGES[0];

  const handleLanguageChange = async (newLanguage: string) => {
    if (newLanguage === i18n.language) return;
    
    try {
      // Update UI language immediately
      await i18n.changeLanguage(newLanguage);
      
      // If user is authenticated, save to backend
      if (user) {
        const apiUrl = import.meta.env.DEV 
          ? 'http://localhost:5001/api/profile/language'
          : '/api/profile/language';
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ language: newLanguage })
        });
        
        if (response.ok) {
          const data = await response.json();
          // Update local storage with new user data
          localStorage.setItem('userData', JSON.stringify(data.user));
          // Refresh user context
          if (refreshUser) {
            await refreshUser();
          }
        }
      }
      
      // Ensure localStorage is in sync
      localStorage.setItem('i18nextLng', newLanguage);
    } catch (error) {
      console.error('Failed to change language:', error);
      // Revert on error
      await i18n.changeLanguage(currentLanguage.code);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'icon' ? 'icon' : 'sm'}
          className={`cursor-pointer overflow-visible ${className}`}
          aria-label={t('navigation:language')}
        >
          {currentLanguage.icon}
          {variant === 'full' && (
            <span className="ml-2 text-sm">{currentLanguage.name}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        {LANGUAGES.map((lang) => {
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="cursor-pointer flex items-center justify-between overflow-visible"
            >
              <div className="flex items-center gap-2">
                {lang.icon}
                <span>{lang.name}</span>
              </div>
              {i18n.language === lang.code && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Mobile-friendly version for use in mobile menu (without dropdown)
interface MobileLanguageItemProps {
  onSelect?: () => void;
}

export function MobileLanguageItems({ onSelect }: MobileLanguageItemProps) {
  const { i18n } = useTranslation('navigation');
  const { user, refreshUser } = useAuth();

  const handleLanguageChange = async (newLanguage: string) => {
    if (newLanguage === i18n.language) return;
    
    try {
      await i18n.changeLanguage(newLanguage);
      
      if (user) {
        const apiUrl = import.meta.env.DEV 
          ? 'http://localhost:5001/api/profile/language'
          : '/api/profile/language';
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ language: newLanguage })
        });
        
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('userData', JSON.stringify(data.user));
          if (refreshUser) {
            await refreshUser();
          }
        }
      }
      
      localStorage.setItem('i18nextLng', newLanguage);
      
      if (onSelect) {
        onSelect();
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  return (
    <>
      {LANGUAGES.map((lang) => {
        return (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`w-full px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer border-b border-muted flex items-center justify-between ${
              i18n.language === lang.code ? 'bg-accent/50' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              {lang.icon}
              <span>{lang.name}</span>
            </div>
            {i18n.language === lang.code && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </button>
        );
      })}
    </>
  );
}
