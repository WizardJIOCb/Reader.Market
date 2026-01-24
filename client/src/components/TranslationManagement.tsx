import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, Loader2, XCircle, RotateCw, Pause } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StatusDetails {
  step: string;
  currentChunk?: number;
  totalChunks?: number;
  message?: string;
  updatedAt?: string;
}

interface Translation {
  id: string;
  language: string;
  translationType: string;
  translationService: string | null;
  fileType: string;
  fileSize: number;
  status: string;
  progress: number;
  statusDetails?: StatusDetails;
  errorMessage?: string;
  createdAt: string;
  completedAt: string | null;
  partialFilePath?: string | null;
  lastCompletedChunk?: number | null;
  totalChunks?: number | null;
  totalCharacters?: number | null;
  translatedCharacters?: number | null;
}

interface AvailableModel {
  service: string;
  models: string[];
  available: boolean;
}

interface TranslationManagementProps {
  bookId: string;
  bookFileType: string;
}

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ar', name: 'العربية' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
];

export function TranslationManagement({ bookId, bookFileType }: TranslationManagementProps) {
  const { t } = useTranslation('admin');
  const { toast } = useToast();
  
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  
  const [translationMethod, setTranslationMethod] = useState<'upload' | 'ai'>('upload');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedService, setSelectedService] = useState('ollama');
  const [selectedModel, setSelectedModel] = useState('');
  const [translationFile, setTranslationFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [translationToDelete, setTranslationToDelete] = useState<Translation | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchTranslations();
    fetchAvailableModels();
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [bookId]);

  useEffect(() => {
    const hasProcessing = translations.some(t => t.status === 'processing' || t.status === 'pending');
    
    if (hasProcessing && !pollingInterval) {
      const interval = setInterval(fetchTranslations, 2000);
      setPollingInterval(interval);
    } else if (!hasProcessing && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [translations]);

  const fetchTranslations = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/translations`);
      if (response.ok) {
        const data = await response.json();
        setTranslations(data);
      }
    } catch (error) {
      console.error('Error fetching translations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:5001/api/admin/translation/models'
        : '/api/admin/translation/models';
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setAvailableModels(data);
        
        const ollamaModels = data.find((s: AvailableModel) => s.service === 'ollama');
        
        if (ollamaModels && ollamaModels.models.length > 0) {
          setSelectedModel(ollamaModels.models[0]);
        }
      } else {
        console.error('Failed to fetch models, status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTranslationFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!translationFile || !selectedLanguage) {
      toast({
        title: t('common.error'),
        description: 'Please select language and file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('translationFile', translationFile);
      formData.append('language', selectedLanguage);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/books/${bookId}/translations/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        toast({
          title: t('common.success'),
          description: t('books.translations.messages.uploadSuccess'),
        });
        setTranslationFile(null);
        setSelectedLanguage('');
        fetchTranslations();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : 'Failed to upload translation',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateConfirm = () => {
    setGenerateDialogOpen(true);
  };

  const handleGenerate = async () => {
    if (!selectedLanguage || !selectedService) {
      toast({
        title: t('common.error'),
        description: 'Please select language and service',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    setGenerateDialogOpen(false);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/books/${bookId}/translations/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: selectedLanguage,
          translationService: selectedService,
          ollamaModel: selectedService === 'ollama' ? selectedModel : undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: t('common.success'),
          description: t('books.translations.messages.generateStarted'),
        });
        setSelectedLanguage('');
        fetchTranslations();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Generation failed');
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : 'Failed to start translation',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (translation: Translation) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/books/${bookId}/translations/${translation.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: t('common.success'),
          description: 'Translation deleted successfully',
        });
        fetchTranslations();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Failed to delete translation',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setTranslationToDelete(null);
    }
  };

  const handlePause = async (translation: Translation) => {
    setPausingId(translation.id);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/books/${bookId}/translations/${translation.id}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: t('common.success'),
          description: (
            <div>
              <div>{t('books.translations.pauseSuccess')}</div>
              <div className="text-xs mt-1 opacity-75">{t('books.translations.pausingNote')}</div>
            </div>
          ),
        });
        fetchTranslations();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Pause failed');
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : 'Failed to pause translation',
        variant: 'destructive',
      });
    } finally {
      setPausingId(null);
    }
  };

  const handleResume = async (translation: Translation) => {
    setResumingId(translation.id);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/books/${bookId}/translations/${translation.id}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: t('common.success'),
          description: t('books.translations.resumeSuccess'),
        });
        fetchTranslations();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Resume failed');
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : 'Failed to resume translation',
        variant: 'destructive',
      });
    } finally {
      setResumingId(null);
    }
  };

  // Helper to format status details for display
  const formatStatusDetails = (translation: Translation): string => {
    if (!translation.statusDetails) {
      return '';
    }
    const details = translation.statusDetails;
    
    // Translate common messages
    let message = details.message || details.step || '';
    
    // Parse "Translating chunk X of Y..." pattern
    const chunkMatch = message.match(/Translating chunk (\d+) of (\d+)/i);
    if (chunkMatch) {
      const [, current, total] = chunkMatch;
      message = `${t('books.translations.translatingChunk')} ${current} ${t('books.translations.of')} ${total}...`;
    }
    
    // Parse "Completed chunk X of Y" pattern
    const completedMatch = message.match(/Completed chunk (\d+) of (\d+)/i);
    if (completedMatch) {
      const [, current, total] = completedMatch;
      message = `${t('books.translations.completedChunk')} ${current} ${t('books.translations.of')} ${total}`;
    }
    
    // Add chunk counter if available
    if (details.currentChunk && details.totalChunks && !chunkMatch && !completedMatch) {
      return `${message} (${details.currentChunk}/${details.totalChunks})`;
    }
    
    return message;
  };

  // Helper to calculate elapsed and estimated time
  const getTimeEstimate = (translation: Translation): { elapsed: string; estimated: string } => {
    const now = new Date();
    const start = new Date(translation.createdAt);
    const elapsedMs = now.getTime() - start.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
    
    const elapsed = elapsedMinutes > 0 
      ? `${elapsedMinutes}m ${elapsedSeconds}s`
      : `${elapsedSeconds}s`;
    
    // Estimate remaining time based on progress
    let estimated = '—';
    // Only show estimate after 10% progress for better accuracy
    if (translation.progress > 10 && translation.progress < 100) {
      // Use exponential smoothing to account for speed changes
      // Assume remaining work takes 20% longer than current average
      const avgTimePerPercent = elapsedMs / translation.progress;
      const remainingPercent = 100 - translation.progress;
      const remainingMs = avgTimePerPercent * remainingPercent * 1.2; // 20% buffer
      
      // Don't show negative estimates
      if (remainingMs > 0) {
        const remainingMinutes = Math.floor(remainingMs / 60000);
        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
        
        if (remainingMinutes > 0) {
          estimated = `~${remainingMinutes}m ${remainingSeconds}s`;
        } else if (remainingSeconds > 0) {
          estimated = `~${remainingSeconds}s`;
        }
      }
    }
    
    return { elapsed, estimated };
  };

  const usedLanguages = translations.map(t => t.language);
  const availableLanguages = LANGUAGE_OPTIONS.filter(lang => !usedLanguages.includes(lang.code));

  const ollamaService = availableModels.find(s => s.service === 'ollama');

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Available Translations List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('books.translations.availableTranslations')}</h3>
        {translations.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('books.translations.noTranslations')}</p>
        ) : (
          <div className="space-y-3">
            {translations.map((translation) => (
              <div key={translation.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {LANGUAGE_OPTIONS.find(l => l.code === translation.language)?.name || translation.language}
                    </span>
                    {translation.language === 'en' && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({t('books.translations.original')})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {(translation.status === 'processing' || translation.status === 'pending') && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePause(translation)}
                          disabled={pausingId === translation.id}
                          title={t('books.translations.pauseTranslation')}
                        >
                          {pausingId === translation.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Pause className="w-4 h-4 text-orange-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTranslationToDelete(translation);
                            setDeleteDialogOpen(true);
                          }}
                          title={t('books.translations.deleteTranslation')}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </>
                    )}
                    {translation.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTranslationToDelete(translation);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    {(translation.status === 'failed' || translation.status === 'paused') && (
                      <>
                        {translation.lastCompletedChunk && translation.lastCompletedChunk > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResume(translation)}
                            disabled={resumingId === translation.id}
                            title={`Resume from chunk ${translation.lastCompletedChunk}`}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            {resumingId === translation.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCw className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTranslationToDelete(translation);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {translation.translationType === 'manual' 
                    ? t('books.translations.manualUpload')
                    : `${t('books.translations.automated')} (${translation.translationService || t('books.translations.unknown')})`}
                </div>

                {(translation.status === 'processing' || translation.status === 'pending') && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{t('books.translations.status.processing')}</span>
                      <span>{translation.progress}%</span>
                    </div>
                    <Progress value={translation.progress} className="h-2" />
                    {translation.statusDetails && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatStatusDetails(translation)}
                      </div>
                    )}
                    {(() => {
                      const { elapsed, estimated } = getTimeEstimate(translation);
                      // Calculate translation speed
                      const now = new Date();
                      const start = new Date(translation.createdAt);
                      const elapsedSeconds = (now.getTime() - start.getTime()) / 1000;
                      const charsPerSecond = translation.translatedCharacters && elapsedSeconds > 0 
                        ? Math.round(translation.translatedCharacters / elapsedSeconds)
                        : 0;
                      
                      return (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex gap-3">
                            <span>{t('books.translations.elapsed')}: {elapsed}</span>
                            {estimated !== '—' && <span>{t('books.translations.estimatedRemaining')}: {estimated}</span>}
                          </div>
                          {translation.totalCharacters && translation.translatedCharacters !== undefined && (
                            <div className="flex gap-3">
                              <span>{t('books.translations.characters')}: {translation.translatedCharacters.toLocaleString()} / {translation.totalCharacters.toLocaleString()}</span>
                              {charsPerSecond > 0 && <span>{t('books.translations.speed')}: {charsPerSecond.toLocaleString()} {t('books.translations.charsPerSec')}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {translation.status === 'paused' && (
                  <div className="text-sm text-orange-600 dark:text-orange-400">
                    {t('books.translations.status.paused')}
                    {translation.lastCompletedChunk && translation.lastCompletedChunk > 0 && translation.totalChunks && (
                      <div className="text-xs text-blue-600 mt-1">
                        {t('books.translations.resumable')}: {translation.lastCompletedChunk}/{translation.totalChunks} {t('books.translations.chunksCompleted')}
                      </div>
                    )}
                  </div>
                )}

                {translation.status === 'failed' && (
                  <div className="text-sm text-destructive space-y-1">
                    <div>{t('books.translations.status.failed')}</div>
                    {translation.errorMessage && (
                      <div className="text-xs opacity-75">{translation.errorMessage}</div>
                    )}
                    {translation.lastCompletedChunk && translation.lastCompletedChunk > 0 && translation.totalChunks && (
                      <div className="text-xs text-blue-600 mt-2">
                        {t('books.translations.resumable')}: {translation.lastCompletedChunk}/{translation.totalChunks} {t('books.translations.chunksCompleted')}
                      </div>
                    )}
                  </div>
                )}

                {translation.status === 'completed' && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    ✓ {t('books.translations.status.completed')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Translation */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">{t('books.translations.addNew')}</h3>
        
        <RadioGroup value={translationMethod} onValueChange={(v) => setTranslationMethod(v as any)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="upload" id="upload" />
            <Label htmlFor="upload">{t('books.translations.uploadFile')}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ai" id="ai" />
            <Label htmlFor="ai">{t('books.translations.generateAI')}</Label>
          </div>
        </RadioGroup>

        <div className="mt-4 space-y-4">
          <div>
            <Label>{t('books.translations.language')}</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {translationMethod === 'upload' ? (
            <>
              <div>
                <Label>File</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors relative">
                  <input
                    type="file"
                    accept={`.${bookFileType}`}
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm mt-2">
                    {translationFile ? translationFile.name : 'Choose translated file'}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading || !translationFile || !selectedLanguage}
              >
                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('books.translations.upload')}
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label>{t('books.translations.service')}</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ollamaService?.available && <SelectItem value="ollama">Ollama</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {selectedService === 'ollama' && ollamaService && (
                <div>
                  <Label>{t('books.translations.model')}</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaService.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                {t('books.translations.freeLocal')}
              </div>

              <Button
                onClick={handleGenerateConfirm}
                disabled={generating || !selectedLanguage || !selectedService}
              >
                {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('books.translations.generate')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('books.translations.messages.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => translationToDelete && handleDelete(translationToDelete)}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Confirmation Dialog */}
      <AlertDialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Translation</AlertDialogTitle>
            <AlertDialogDescription>
              {t('books.translations.messages.generateConfirm', { model: selectedModel })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
