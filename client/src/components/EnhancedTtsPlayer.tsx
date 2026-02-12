import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, Volume2, Square } from 'lucide-react';
import { toast } from 'sonner';

interface TtsSettings {
  provider: 'rhvoice' | 'piper' | 'windows' | 'mimikastudio';
  voice: string;
  rate: number;
  lang: 'ru' | 'en';
}

interface WordTiming {
  word: string;
  start: number; // in seconds
  end: number; // in seconds
  element: HTMLElement | null; // Reference to the DOM element
}

interface EnhancedTtsPlayerProps {
  bookId: string;
  text: string;
  chapterIndex?: number;
  chunkIndex: number;
  onSettingsChange?: (settings: TtsSettings) => void;
  hideText?: boolean; // Option to hide the original text
  onHighlightChange?: (highlightedElement: HTMLElement | null) => void; // Callback when highlighted element changes
}

const EnhancedTtsPlayer: React.FC<EnhancedTtsPlayerProps> = ({
  bookId,
  text,
  chapterIndex,
  chunkIndex,
  onSettingsChange,
  hideText = false,
  onHighlightChange
}) => {
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Split text into words with timing estimates
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const currentWordIndexRef = useRef<number>(-1);

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

  // Calculate word timings based on text and estimated duration
  useEffect(() => {
    if (text && duration > 0) {
      // Simple estimation: assume average reading speed
      // In reality, this would come from the TTS API with word-level timing
      const words = text.split(/\s+/).filter(word => word.trim().length > 0);
      const avgWordDuration = duration / words.length;
      
      const timings: WordTiming[] = words.map((word, index) => ({
        word,
        start: index * avgWordDuration,
        end: (index + 1) * avgWordDuration,
        element: null // Will be populated when highlighting
      }));
      
      setWordTimings(timings);
    }
  }, [text, duration]);

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
          setDuration(data.durationMs / 1000 || 0); // Convert ms to seconds
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
            setDuration(data.durationMs / 1000 || 0); // Convert ms to seconds
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
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
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
    setCurrentTime(0);
    // Clear any active highlights
    clearHighlights();
  };

  // Handle time update for progress and highlighting
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      
      setCurrentTime(currentTime);
      
      if (duration && duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        setProgress(progressPercent);
        
        // Update highlighting based on current time
        updateHighlighting(currentTime);
      }
    }
  };

  // Update highlighting based on current playback time
  const updateHighlighting = (time: number) => {
    // Find the current word based on time
    let currentIndex = -1;
    for (let i = 0; i < wordTimings.length; i++) {
      if (time >= wordTimings[i].start && time <= wordTimings[i].end) {
        currentIndex = i;
        break;
      }
    }
    
    // Only update if the current word has changed
    if (currentIndex !== currentWordIndexRef.current) {
      // Clear previous highlight
      clearHighlights();
      
      // Highlight new word if found
      if (currentIndex >= 0 && currentIndex < wordTimings.length) {
        const wordTiming = wordTimings[currentIndex];
        highlightWord(wordTiming.word, currentIndex);
        currentWordIndexRef.current = currentIndex;
      }
    }
  };

  // Highlight a specific word in the text
  const highlightWord = (word: string, wordIndex: number) => {
    // Since we don't have direct access to the text element, we'll notify the parent
    // component about the word that should be highlighted
    if (onHighlightChange) {
      // Find the word in the text content
      const matches = [];
      let startIndex = 0;
      let matchIndex;
      
      // Case insensitive search for the word
      const lowerTextContent = text.toLowerCase();
      const lowerWord = word.toLowerCase();
      
      while ((matchIndex = lowerTextContent.indexOf(lowerWord, startIndex)) !== -1) {
        matches.push({ index: matchIndex });
        startIndex = matchIndex + 1;
      }
      
      if (matches.length > 0) {
        // Get the specific match based on index
        const matchIndexForUse = Math.min(wordIndex, matches.length - 1);
        const match = matches[matchIndexForUse];
        
        if (match) {
          // Find the element containing this text and highlight it
          const elements = document.querySelectorAll('*');
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element.textContent && element.textContent.toLowerCase().includes(lowerWord)) {
              // This is a simplified approach - in practice, you'd need more sophisticated
              // text matching to identify the correct element
              onHighlightChange(element as HTMLElement);
              break;
            }
          }
        }
      }
    }
  };


  // Clear all highlights
  const clearHighlights = () => {
    // Remove any existing tts highlights
    const highlights = document.querySelectorAll('.tts-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        while (highlight.firstChild) {
          parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
      }
    });
    currentWordIndexRef.current = -1;
  };

  // Scroll highlighted element into view
  const scrollToHighlightedElement = (element: HTMLElement) => {
    // Use smooth scrolling to bring the element into view
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
            {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
          
          {/* Time display */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          
          <audio
            ref={audioRef}
            onEnded={handleAudioEnded}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                setDuration(audioRef.current.duration);
              }
            }}
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

export default EnhancedTtsPlayer;