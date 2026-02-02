import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Volume2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface TtsPersonaPanelProps {
  selectedText: string;
  onClose: () => void;
}

interface CharacterConfig {
  id: string;
  name: string;
  description: string;
}

interface EmotionConfig {
  id: string;
  name: string;
  description: string;
}

interface TTSConfig {
  characters: CharacterConfig[];
  emotions: EmotionConfig[];
}

export const TtsPersonaPanel: React.FC<TtsPersonaPanelProps> = ({ 
  selectedText, 
  onClose 
}) => {
  const [character, setCharacter] = useState('Манус');
  const [emotion, setEmotion] = useState('menacing');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [config, setConfig] = useState<TTSConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation('common');

  // Загружаем конфигурацию при монтировании
  useEffect(() => {
    const loadConfig = async () => {
      try {
        console.log('[TTS PANEL] Loading config from /api/tts/config');
        const response = await fetch('/api/tts/config');
        console.log('[TTS PANEL] Config response status:', response.status);
        
        if (response.ok) {
          const configData = await response.json();
          console.log('[TTS PANEL] Config data received:', configData);
          setConfig(configData);
          
          // Устанавливаем первый доступный персонаж по умолчанию
          if (configData.characters && configData.characters.length > 0) {
            setCharacter(configData.characters[0].id);
            console.log('[TTS PANEL] Default character set to:', configData.characters[0].id);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
      } catch (error) {
        console.error('[TTS PANEL] Failed to load TTS config:', error);
        // Используем дефолтную конфигурацию
        const defaultConfig = {
          characters: [
            { id: 'Манус', name: 'Примарх Манус', description: 'Гнев и авторитет' },
            { id: 'Робаут', name: 'Робаут Гильманн', description: 'Тени и тайны' },
            { id: 'Корнелиус', name: 'Корнелиус', description: 'Свет и правда' }
          ],
          emotions: [
            { id: 'menacing', name: 'Грозный', description: 'Угрожающий тон' },
            { id: 'heroic', name: 'Героический', description: 'Вдохновляющий тон' },
            { id: 'mysterious', name: 'Таинственный', description: 'Загадочный тон' }
          ]
        };
        console.log('[TTS PANEL] Using default config:', defaultConfig);
        setConfig(defaultConfig);
        setCharacter(defaultConfig.characters[0].id);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadConfig();
  }, []);

  const handleGenerate = async () => {
    if (!selectedText.trim()) {
      toast({
        title: t('error'),
        description: t('tts.selectTextForTts'),
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);
    
    try {
      console.log('[TTS PANEL] Sending request:', { text: selectedText, character, emotion });
      
      // Получаем токен авторизации
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error(t('auth.required'));
      }
      
      const response = await fetch('/api/tts/persona', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          text: selectedText.trim(), 
          character, 
          emotion 
        })
      });
      
      console.log('[TTS PANEL] Response status:', response.status);
      
      const result = await response.json();
      console.log('[TTS PANEL] Response data:', result);
      
      if (result.success) {
        setAudioUrl(result.audioUrl);
        toast({ 
          title: t('success'), 
          description: t('tts.audioGeneratedSuccessfully') 
        });
      } else {
        throw new Error(result.error || t('tts.generationFailed'));
      }
      
    } catch (error) {
      console.error('[TTS PANEL] Generation error:', error);
      toast({
        title: t('tts.generationError'),
        description: error instanceof Error ? error.message : t('common.unknownError'),
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(error => {
        console.error('Failed to play audio:', error);
        toast({
          title: t('tts.playbackError'),
          description: t('tts.failedToPlayAudio'),
          variant: 'destructive'
        });
      });
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">{t('common.loading')}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="h-full pb-20">
        <div className="p-4 space-y-6">
        {/* Предпросмотр выбранного текста */}
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm max-w-full">
          <p className="text-gray-600 dark:text-gray-400 mb-1">{t('tts.selectedText')}:</p>
          <div className="max-h-32 overflow-y-auto">
            <p className="whitespace-normal break-words overflow-wrap-anywhere text-sm">{selectedText || t('tts.noTextSelected')}</p>
          </div>
        </div>
        
        {/* Выбор персонажа */}
        <div>
          <label className="block text-sm font-medium mb-1">{t('tts.character')}:</label>
          <Select value={character} onValueChange={setCharacter}>
            <SelectTrigger>
              <SelectValue placeholder={t('tts.selectCharacterPlaceholder')} />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[200px]">
              {config?.characters && config.characters.length > 0 ? (
                config.characters.map((char) => (
                  <SelectItem key={char.id} value={char.id} className="py-3 pl-3 text-left">
                    <div className="flex items-center text-left">
                      <span className="font-medium truncate leading-tight text-left">
                        {char.name} <span className="text-xs text-gray-500 font-normal">({char.description})</span>
                      </span>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="loading" disabled className="py-3 pl-3 text-left">
                  <span className="text-gray-500 text-left">{t('common.loading')}...</span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {config && config.characters && (
            <div className="text-xs text-gray-400 mt-1">
              {t('tts.loadedCharacters', { count: config.characters.length })}
            </div>
          )}
        </div>
        
        {/* Выбор эмоции */}
        <div>
          <label className="block text-sm font-medium mb-1">{t('tts.emotion')}:</label>
          <Select value={emotion} onValueChange={setEmotion}>
            <SelectTrigger>
              <SelectValue placeholder={t('tts.selectEmotionPlaceholder')} />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[200px]">
              {config?.emotions && config.emotions.length > 0 ? (
                config.emotions.map((emo) => (
                  <SelectItem key={emo.id} value={emo.id} className="py-3 pl-3 text-left">
                    <div className="flex items-center text-left">
                      <span className="font-medium truncate leading-tight text-left">
                        {emo.name} <span className="text-xs text-gray-500 font-normal">({emo.description})</span>
                      </span>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="loading" disabled className="py-3 pl-3 text-left">
                  <span className="text-gray-500 text-left">{t('common.loading')}...</span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {config && config.emotions && (
            <div className="text-xs text-gray-400 mt-1">
              {t('tts.loadedEmotions', { count: config.emotions.length })}
            </div>
          )}
        </div>
        
        {/* Кнопка генерации */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedText.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <span className="flex items-center">
              <span className="animate-spin mr-2">⏱</span>
              {t('tts.generating')}...
            </span>
          ) : (
            t('tts.readAloud')
          )}
        </Button>
        
        {/* Аудио плеер */}
        {audioUrl && (
          <div className="space-y-2">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
              <p className="text-green-800 dark:text-green-200 text-sm">
                {t('tts.audioReadyForPlayback')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePlayAudio} className="flex-1">
                ▶ {t('tts.play')}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setAudioUrl(null)}
              >
                {t('tts.clear')}
              </Button>
            </div>
          </div>
        )}
        
        {/* Информация */}
        <div className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t">
          <p>{t('tts.selectTextInstruction')}</p>
          <p className="mt-1">{t('tts.supportedCharacters')}</p>
          <p className="mt-1">{t('tts.selectCharacterInstruction')}</p>
        </div>
      </div>
    </ScrollArea>
  </div>
);
};