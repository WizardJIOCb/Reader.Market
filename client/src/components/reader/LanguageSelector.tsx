import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check } from 'lucide-react';

interface Translation {
  language: string;
  status: string;
}

interface LanguageSelectorProps {
  bookId: string;
  currentLanguage: string;
  availableLanguages: Translation[];
  onLanguageChange: (language: string) => void;
}

const LANGUAGE_NAMES: Record<string, string> = {
  original: 'English',
  en: 'English',
  ru: 'Русский',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  ja: '日本語',
  ar: 'العربية',
  pt: 'Português',
  it: 'Italiano',
};

export function LanguageSelector({
  bookId,
  currentLanguage,
  availableLanguages,
  onLanguageChange,
}: LanguageSelectorProps) {
  const { t } = useTranslation('books');

  return (
    <div className="w-64 p-2">
      <div className="mb-2 px-2 text-sm font-semibold text-muted-foreground">
        {t('reader.language')}
      </div>
      <div className="space-y-1">
        {/* Original language */}
        <button
          onClick={() => onLanguageChange('original')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
            currentLanguage === 'original'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <span>
            {LANGUAGE_NAMES['original']} {' '}
            <span className="text-xs text-muted-foreground">({t('admin:books.translations.original')})</span>
          </span>
          {currentLanguage === 'original' && <Check className="w-4 h-4" />}
        </button>

        {/* Available translations */}
        {availableLanguages.map((translation) => {
          const isCompleted = translation.status === 'completed';
          const isProcessing = translation.status === 'processing' || translation.status === 'pending';
          const isCurrent = currentLanguage === translation.language;

          return (
            <button
              key={translation.language}
              onClick={() => isCompleted && onLanguageChange(translation.language)}
              disabled={!isCompleted}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isCompleted
                  ? 'hover:bg-accent hover:text-accent-foreground'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <span>
                {LANGUAGE_NAMES[translation.language] || translation.language}
                {isProcessing && (
                  <span className="ml-2 text-xs">({t('admin:books.translations.status.processing')})</span>
                )}
              </span>
              {isCurrent && <Check className="w-4 h-4" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
