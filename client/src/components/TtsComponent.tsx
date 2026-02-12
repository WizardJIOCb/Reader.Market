import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, Settings, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

interface TtsSettings {
  provider: 'rhvoice' | 'piper' | 'windows' | 'mimikastudio';
  voice: string;
  rate: number;
  lang: 'ru' | 'en';
}

interface TtsComponentProps {
  bookId: string;
  text: string;
  chapterIndex?: number;
  chunkIndex: number;
  onSettingsChange?: (settings: TtsSettings) => void;
  hideText?: boolean; // Option to hide the original text
}

const TtsComponent: React.FC<TtsComponentProps> = ({
  bookId,
  text,
  chapterIndex,
  chunkIndex,
  onSettingsChange,
  hideText = false
}) => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  
  console.log(`[TTS-COMPONENT] Render #${renderCountRef.current} with props:`, { bookId, hideText });
  
  const { t } = useTranslation('tts');
  const [settings, setSettings] = useState<TtsSettings>({
    provider: 'windows',
    voice: 'en_US-lessac',
    rate: 1.0,
    lang: 'en'
  });
  
  const [voices, setVoices] = useState<Array<{id: string, name: string}>>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'ready' | 'queued' | 'processing' | 'failed'>('ready');
  const [progress, setProgress] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch available voices
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(
          `/api/tts/voices?provider=${settings.provider}&lang=${settings.lang}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          setVoices(data.voices);
          
          // Set default voice if current one is not available
          if (!data.voices.some((v: any) => v.id === settings.voice)) {
            if (data.voices.length > 0) {
              const newSettings = {
                ...settings,
                voice: data.voices[0].id
              };
              setSettings(newSettings);
              onSettingsChange?.(newSettings);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
        toast.error('Failed to load voice options');
      }
    };

    fetchVoices();
  }, [settings.provider, settings.lang]);

  // Handle settings change
  const handleSettingsChange = (newSettings: Partial<TtsSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    onSettingsChange?.(updatedSettings);
  };

  // Process text chunk
  const processChunk = async () => {
    setIsLoading(true);
    setJobStatus('processing');
    
    // Truncate text to max 5000 characters to avoid API error
    const truncatedText = text.length > 5000 ? text.substring(0, 5000) : text;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/tts/chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookId,
          chapterIndex,
          chunkIndex,
          text: truncatedText,
          lang: settings.lang,
          provider: settings.provider,
          voice: settings.voice,
          rate: settings.rate
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'ready') {
          setAudioUrl(data.audioUrl);
          setJobStatus('ready');
          setIsLoading(false);
          return data.audioUrl;
        } else if (data.status === 'queued') {
          setJobStatus('queued');
          // Start polling for job completion
          pollForCompletion(data.textHash);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process text');
      }
    } catch (error: any) {
      console.error('TTS processing error:', error);
      toast.error(error.message || 'Failed to process text for speech');
      setJobStatus('failed');
      setIsLoading(false);
    }
  };

  // Poll for job completion
  const pollForCompletion = (textHash: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/tts/status?textHash=${textHash}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'ready') {
            setAudioUrl(data.audioUrl);
            setJobStatus('ready');
            setIsLoading(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            // Auto-play when ready
            if (isPlaying) {
              playAudio(data.audioUrl);
            }
          } else if (data.status === 'failed') {
            setJobStatus('failed');
            setIsLoading(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast.error('Text-to-speech synthesis failed');
          }
          // Continue polling for 'queued' or 'processing'
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds
  };

  // Play audio
  const playAudio = (url?: string) => {
    const audioUrlToPlay = url || audioUrl;
    if (!audioUrlToPlay) return;

    if (audioRef.current) {
      audioRef.current.src = audioUrlToPlay;
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(error => {
          console.error('Playback error:', error);
          toast.error('Failed to play audio');
        });
    }
  };

  // Handle play/pause
  const togglePlay = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (audioUrl) {
        playAudio();
      } else if (jobStatus === 'ready') {
        // Audio is ready but not loaded
        await processChunk();
      } else if (jobStatus === 'failed' || jobStatus === 'queued') {
        // Retry processing
        await processChunk();
      }
    }
  };

  // Reset and reprocess
  const resetAndProcess = async () => {
    // Clear cache entry by changing a parameter slightly
    const newRate = settings.rate === 1.0 ? 1.01 : 1.0;
    handleSettingsChange({ rate: newRate });
    
    setAudioUrl(null);
    setJobStatus('ready');
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    await processChunk();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Handle audio ended
  const handleAudioEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    // TODO: Auto-advance to next chunk
  };

  // Handle time update for progress
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progressPercent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(progressPercent);
    }
  };

  return (
    <div className="bg-background border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t('playback')}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              {jobStatus === 'queued' && t('queued')}
              {jobStatus === 'processing' && t('processing')}
            </div>
          )}
          
          <Button
            size="sm"
            variant={isPlaying ? "secondary" : "default"}
            onClick={togglePlay}
            disabled={isLoading && jobStatus !== 'ready'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {!isPlaying && <span className="ml-2">{t('listen')}</span>}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={resetAndProcess}
            disabled={isLoading}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {audioUrl && (
        <div className="space-y-2">
          <div className="w-full bg-orange-200 rounded-full h-2">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <audio
            ref={audioRef}
            onEnded={handleAudioEnded}
            onTimeUpdate={handleTimeUpdate}
            className="hidden"
          />
        </div>
      )}

      {/* Settings */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('provider')}</label>
          <Select
            value={settings.provider}
            onValueChange={(value) => handleSettingsChange({ provider: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="piper">Piper</SelectItem>
              <SelectItem value="rhvoice">RHVoice</SelectItem>
              <SelectItem value="windows">Windows</SelectItem>
              <SelectItem value="mimikastudio">MimikaStudio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('voice')}</label>
          <Select
            value={settings.voice}
            onValueChange={(value) => handleSettingsChange({ voice: value })}
            disabled={voices.length === 0}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('language')}</label>
          <Select
            value={settings.lang}
            onValueChange={(value) => handleSettingsChange({ lang: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ru">Russian</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('speed')}: {settings.rate.toFixed(2)}x
          </label>
          <Slider
            value={[settings.rate]}
            onValueChange={([value]) => handleSettingsChange({ rate: value })}
            min={0.5}
            max={2.0}
            step={0.1}
            className="w-full"
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className="text-sm text-muted-foreground">
        {jobStatus === 'ready' && audioUrl && t('readyToPlay')}
        {jobStatus === 'ready' && !audioUrl && t('clickToGenerate')}
        {jobStatus === 'failed' && t('generationFailed')}
      </div>
    </div>
  );
};

export default TtsComponent;