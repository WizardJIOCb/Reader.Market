import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Volume2, Trash2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { loggerFactory } from '@/lib/loggingConfig';

// Create logger for TTS module
const ttsLogger = loggerFactory.getLogger('tts');

interface TtsConfig {
  id: string;
  ttsEnabled: boolean;
  enabledProviders: string[];
  defaultProvider: string;
  defaultLang: string;
  defaultVoiceRu: string;
  defaultVoiceEn: string;
  defaultRate: number;
  minRate: number;
  maxRate: number;
  chunkMinChars: number;
  chunkMaxChars: number;
  audioFormat: string;
  mp3Bitrate: number;
  queueConcurrency: number;
  cacheMaxGb: number;
  cacheTtlDays: number;
  rhvoiceBinPath: string;
  piperBinPath: string;
  piperModelsDir: string;
  mimikaStudioApiUrl: string;
  mimikaStudioApiKey: string;
  mimikaStudioModelsDir: string;
  updatedAt: string;
}

const TtsAdminSettings: React.FC = () => {
  ttsLogger.debug('Component function executed');
  
  const { toast } = useToast();
  const { t } = useTranslation(['admin', 'common']);
  
  const [config, setConfig] = useState<TtsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cacheStats, setCacheStats] = useState({ sizeGb: 0, fileCount: 0 });
  
  ttsLogger.debug('=== TTS ADMIN SETTINGS COMPONENT RENDERING ===');
  ttsLogger.debug('Component mounted, setting up state...');
  ttsLogger.debug(`Current config state: ${JSON.stringify(config)}`);
  ttsLogger.debug(`Current loading state: ${loading}`);

  useEffect(() => {
    ttsLogger.debug('useEffect triggered - fetching initial data');
    fetchConfig();
    fetchCacheStats();
    
    // Add debug info for component mount
    ttsLogger.debug('Component mounted with initial state:');
    ttsLogger.debug(`Loading state: ${loading}`);
    ttsLogger.debug(`Config state: ${JSON.stringify(config)}`);
    ttsLogger.debug(`Config.ttsEnabled value: ${config?.ttsEnabled}`);
    ttsLogger.debug(`Config.ttsEnabled type: ${typeof config?.ttsEnabled}`);
  }, []);

  // Watch for config changes
  useEffect(() => {
    ttsLogger.debug('Config changed - re-render triggered');
    ttsLogger.debug(`New config state: ${JSON.stringify(config)}`);
    ttsLogger.debug(`New config.ttsEnabled value: ${config?.ttsEnabled}`);
    ttsLogger.debug(`New config.ttsEnabled type: ${typeof config?.ttsEnabled}`);
  }, [config]);

  const fetchConfig = async () => {
    ttsLogger.debug('fetchConfig called');
    
    try {
      setLoading(true);
      const authToken = localStorage.getItem('authToken');
      ttsLogger.debug(`Auth token for fetchConfig: ${!!authToken}`);
      
      const response = await fetch('/api/tts/admin/config', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      ttsLogger.debug(`Fetch config response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        ttsLogger.debug(`Fetched config data: ${JSON.stringify(data)}`);
        ttsLogger.debug(`ttsEnabled value: ${data.ttsEnabled}`);
        ttsLogger.debug(`ttsEnabled type: ${typeof data.ttsEnabled}`);
        
        // Ensure all required fields have proper defaults
        const configWithDefaults = {
          ...data,
          // Ensure numeric fields have defaults
          defaultRate: typeof data.defaultRate === 'number' && !isNaN(data.defaultRate) ? data.defaultRate : 1.00,
          minRate: typeof data.minRate === 'number' && !isNaN(data.minRate) ? data.minRate : 0.80,
          maxRate: typeof data.maxRate === 'number' && !isNaN(data.maxRate) ? data.maxRate : 1.25,
          chunkMinChars: typeof data.chunkMinChars === 'number' && !isNaN(data.chunkMinChars) ? data.chunkMinChars : 400,
          chunkMaxChars: typeof data.chunkMaxChars === 'number' && !isNaN(data.chunkMaxChars) ? data.chunkMaxChars : 1800,
          mp3Bitrate: typeof data.mp3Bitrate === 'number' && !isNaN(data.mp3Bitrate) ? data.mp3Bitrate : 64,
          queueConcurrency: typeof data.queueConcurrency === 'number' && !isNaN(data.queueConcurrency) ? data.queueConcurrency : 1,
          cacheMaxGb: typeof data.cacheMaxGb === 'number' && !isNaN(data.cacheMaxGb) ? data.cacheMaxGb : 20,
          cacheTtlDays: typeof data.cacheTtlDays === 'number' && !isNaN(data.cacheTtlDays) ? data.cacheTtlDays : 90,
          // Ensure string fields have defaults
          defaultLang: typeof data.defaultLang === 'string' ? data.defaultLang : 'en',
          defaultVoiceRu: typeof data.defaultVoiceRu === 'string' ? data.defaultVoiceRu : '',
          defaultVoiceEn: typeof data.defaultVoiceEn === 'string' ? data.defaultVoiceEn : '',
          audioFormat: typeof data.audioFormat === 'string' ? data.audioFormat : 'mp3',
          rhvoiceBinPath: typeof data.rhvoiceBinPath === 'string' ? data.rhvoiceBinPath : '',
          piperBinPath: typeof data.piperBinPath === 'string' ? data.piperBinPath : '',
          piperModelsDir: typeof data.piperModelsDir === 'string' ? data.piperModelsDir : '',
          // Ensure array field has default
          enabledProviders: Array.isArray(data.enabledProviders) ? data.enabledProviders : ['rhvoice', 'piper'],
          // Ensure string field has default
          defaultProvider: typeof data.defaultProvider === 'string' && data.defaultProvider !== '' ? data.defaultProvider : 'windows',
          // Ensure boolean field
          ttsEnabled: typeof data.ttsEnabled === 'boolean' ? data.ttsEnabled : false
        };
        
        ttsLogger.debug(`Config with defaults: ${JSON.stringify(configWithDefaults)}`);
        ttsLogger.debug(`Final ttsEnabled value: ${configWithDefaults.ttsEnabled}`);
        ttsLogger.debug(`Final ttsEnabled type: ${typeof configWithDefaults.ttsEnabled}`);
        setConfig(configWithDefaults);
      } else {
        const errorText = await response.text();
        ttsLogger.error(`Failed to fetch config: ${response.status} ${errorText}`);
        toast({
          variant: 'destructive',
          title: t('common:error'),
          description: `HTTP ${response.status}: ${errorText}`
        });
      }
    } catch (error) {
      ttsLogger.error(`Error fetching TTS config: ${error}`);
      toast({
        variant: 'destructive',
        title: t('common:error'),
        description: error instanceof Error ? error.message : 'Не удалось загрузить конфигурацию TTS'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCacheStats = async () => {
    ttsLogger.debug('fetchCacheStats called');
    
    try {
      const authToken = localStorage.getItem('authToken');
      ttsLogger.debug(`Auth token for fetchCacheStats: ${!!authToken}`);
      
      const response = await fetch('/api/tts/admin/cache-stats', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      ttsLogger.debug(`Fetch cache stats response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        ttsLogger.debug(`Fetched cache stats: ${JSON.stringify(data)}`);
        setCacheStats(data);
      }
    } catch (error) {
      ttsLogger.error(`Error fetching cache stats: ${error}`);
    }
  };

  const saveConfig = async () => {
    ttsLogger.debug('saveConfig called');
    ttsLogger.debug(`Current config to save: ${JSON.stringify(config)}`);
    
    if (!config) {
      ttsLogger.error('No config to save');
      return;
    }
    
    // Ensure all numeric values are properly converted and add defaults
    const sanitizedConfig = {
      ...config,
      // Numeric fields with proper defaults from database schema
      defaultRate: typeof config.defaultRate === 'number' && !isNaN(config.defaultRate) ? config.defaultRate : 1.00,
      minRate: typeof config.minRate === 'number' && !isNaN(config.minRate) ? config.minRate : 0.80,
      maxRate: typeof config.maxRate === 'number' && !isNaN(config.maxRate) ? config.maxRate : 1.25,
      chunkMinChars: typeof config.chunkMinChars === 'number' && !isNaN(config.chunkMinChars) ? config.chunkMinChars : 400,
      chunkMaxChars: typeof config.chunkMaxChars === 'number' && !isNaN(config.chunkMaxChars) ? config.chunkMaxChars : 1800,
      mp3Bitrate: typeof config.mp3Bitrate === 'number' && !isNaN(config.mp3Bitrate) ? config.mp3Bitrate : 64,
      queueConcurrency: typeof config.queueConcurrency === 'number' && !isNaN(config.queueConcurrency) ? config.queueConcurrency : 1,
      cacheMaxGb: typeof config.cacheMaxGb === 'number' && !isNaN(config.cacheMaxGb) ? config.cacheMaxGb : 20,
      cacheTtlDays: typeof config.cacheTtlDays === 'number' && !isNaN(config.cacheTtlDays) ? config.cacheTtlDays : 90,
      // String fields with defaults
      defaultLang: typeof config.defaultLang === 'string' ? config.defaultLang : 'en',
      defaultVoiceRu: typeof config.defaultVoiceRu === 'string' ? config.defaultVoiceRu : '',
      defaultVoiceEn: typeof config.defaultVoiceEn === 'string' ? config.defaultVoiceEn : '',
      audioFormat: typeof config.audioFormat === 'string' ? config.audioFormat : 'mp3',
      rhvoiceBinPath: typeof config.rhvoiceBinPath === 'string' ? config.rhvoiceBinPath : '',
      piperBinPath: typeof config.piperBinPath === 'string' ? config.piperBinPath : '',
      piperModelsDir: typeof config.piperModelsDir === 'string' ? config.piperModelsDir : '',
      // Array field with default
      enabledProviders: Array.isArray(config.enabledProviders) ? config.enabledProviders : ['rhvoice', 'piper'],
      // String field with default
      defaultProvider: typeof config.defaultProvider === 'string' && config.defaultProvider !== '' ? config.defaultProvider : 'windows',
      // Boolean field
      ttsEnabled: Boolean(config.ttsEnabled)
    };
    
    ttsLogger.debug(`Full sanitized config to send: ${JSON.stringify(sanitizedConfig)}`);
    ttsLogger.debug(`ttsEnabled in sanitized config: ${sanitizedConfig.ttsEnabled}`);
    
    try {
      setSaving(true);
      ttsLogger.debug('Attempting to save config...');
      
      const authToken = localStorage.getItem('authToken');
      ttsLogger.debug(`Auth token present: ${!!authToken}`);
      
      const response = await fetch('/api/tts/admin/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sanitizedConfig)
      });
      
      ttsLogger.debug(`Save config API response status: ${response.status}`);
      
      if (response.ok) {
        ttsLogger.debug('✅ Full config saved successfully');
        // Immediately fetch the config to verify it was saved correctly
        ttsLogger.debug('Fetching config to verify save...');
        await fetchConfig();
        toast({
          title: t('common:success'),
          description: 'Конфигурация TTS успешно сохранена'
        });
      } else {
        const errorText = await response.text();
        ttsLogger.error(`❌ Failed to save full config: ${response.status} ${errorText}`);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      ttsLogger.error(`Error saving TTS config: ${error}`);
      toast({
        variant: 'destructive',
        title: t('common:error'),
        description: error instanceof Error ? error.message : 'Не удалось сохранить конфигурацию TTS'
      });
    } finally {
      setSaving(false);
    }
  };

  const clearCache = async () => {
    ttsLogger.debug('clearCache called');
    
    if (!confirm('Вы уверены, что хотите очистить кэш TTS? Это удалит все сгенерированные аудиофайлы.')) {
      return;
    }
    
    try {
      const authToken = localStorage.getItem('authToken');
      ttsLogger.debug(`Auth token for clearCache: ${!!authToken}`);
      
      const response = await fetch('/api/tts/admin/clear-cache', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      ttsLogger.debug(`Clear cache response status: ${response.status}`);
      
      if (response.ok) {
        ttsLogger.debug('✅ Cache cleared successfully');
        toast({
          title: t('common:success'),
          description: 'Кэш TTS успешно очищен'
        });
        fetchCacheStats(); // Refresh cache stats
      } else {
        const errorText = await response.text();
        ttsLogger.error(`❌ Failed to clear cache: ${response.status} ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      ttsLogger.error(`Error clearing cache: ${error}`);
      toast({
        variant: 'destructive',
        title: t('common:error'),
        description: error instanceof Error ? error.message : 'Не удалось очистить кэш TTS'
      });
    }
  };

  const toggleTtsEnabled = async (enabled: boolean) => {
    console.log('toggleTtsEnabled called with:', enabled);
    console.log('Current config:', config);
    
    if (!config) {
      console.error('No config available');
      return;
    }
    
    const updatedConfig = { ...config, ttsEnabled: enabled };
    console.log('Updated config:', updatedConfig);
    console.log('ttsEnabled being set to:', enabled);
    setConfig(updatedConfig);
    
    // Auto-save the change
    try {
      setSaving(true);
      console.log('Attempting to save config...');
      
      const authToken = localStorage.getItem('authToken');
      console.log('Auth token present:', !!authToken);
      
      const sanitizedConfig = {
        ...updatedConfig,
        // Numeric fields with proper defaults from database schema
        defaultRate: typeof updatedConfig.defaultRate === 'number' && !isNaN(updatedConfig.defaultRate) ? updatedConfig.defaultRate : 1.00,
        minRate: typeof updatedConfig.minRate === 'number' && !isNaN(updatedConfig.minRate) ? updatedConfig.minRate : 0.80,
        maxRate: typeof updatedConfig.maxRate === 'number' && !isNaN(updatedConfig.maxRate) ? updatedConfig.maxRate : 1.25,
        chunkMinChars: typeof updatedConfig.chunkMinChars === 'number' && !isNaN(updatedConfig.chunkMinChars) ? updatedConfig.chunkMinChars : 400,
        chunkMaxChars: typeof updatedConfig.chunkMaxChars === 'number' && !isNaN(updatedConfig.chunkMaxChars) ? updatedConfig.chunkMaxChars : 1800,
        mp3Bitrate: typeof updatedConfig.mp3Bitrate === 'number' && !isNaN(updatedConfig.mp3Bitrate) ? updatedConfig.mp3Bitrate : 64,
        queueConcurrency: typeof updatedConfig.queueConcurrency === 'number' && !isNaN(updatedConfig.queueConcurrency) ? updatedConfig.queueConcurrency : 1,
        cacheMaxGb: typeof updatedConfig.cacheMaxGb === 'number' && !isNaN(updatedConfig.cacheMaxGb) ? updatedConfig.cacheMaxGb : 20,
        cacheTtlDays: typeof updatedConfig.cacheTtlDays === 'number' && !isNaN(updatedConfig.cacheTtlDays) ? updatedConfig.cacheTtlDays : 90,
        // String fields with defaults
        defaultLang: typeof updatedConfig.defaultLang === 'string' ? updatedConfig.defaultLang : 'en',
        defaultVoiceRu: typeof updatedConfig.defaultVoiceRu === 'string' ? updatedConfig.defaultVoiceRu : '',
        defaultVoiceEn: typeof updatedConfig.defaultVoiceEn === 'string' ? updatedConfig.defaultVoiceEn : '',
        audioFormat: typeof updatedConfig.audioFormat === 'string' ? updatedConfig.audioFormat : 'mp3',
        rhvoiceBinPath: typeof updatedConfig.rhvoiceBinPath === 'string' ? updatedConfig.rhvoiceBinPath : '',
        piperBinPath: typeof updatedConfig.piperBinPath === 'string' ? updatedConfig.piperBinPath : '',
        piperModelsDir: typeof updatedConfig.piperModelsDir === 'string' ? updatedConfig.piperModelsDir : '',
        // Array field with default
        enabledProviders: Array.isArray(updatedConfig.enabledProviders) ? updatedConfig.enabledProviders : ['rhvoice', 'piper'],
        // String field with default
        defaultProvider: typeof updatedConfig.defaultProvider === 'string' && updatedConfig.defaultProvider !== '' ? updatedConfig.defaultProvider : 'windows',
        // Boolean field
        ttsEnabled: Boolean(updatedConfig.ttsEnabled)
      };
      
      console.log('Sanitized config to send:', sanitizedConfig);
      console.log('ttsEnabled in sanitized config:', sanitizedConfig.ttsEnabled);
      
      const response = await fetch('/api/tts/admin/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sanitizedConfig)
      });
      
      console.log('API response status:', response.status);
      
      if (response.ok) {
        console.log('✅ TTS settings saved successfully');
        toast({
          title: t('common:success'),
          description: 'Настройки TTS сохранены'
        });
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to save TTS settings:', response.status, errorText);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Error saving TTS settings:', error);
      toast({
        variant: 'destructive',
        title: t('common:error'),
        description: error instanceof Error ? error.message : 'Не удалось сохранить настройки TTS'
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleProvider = async (provider: string) => {
    console.warn('[TTS-ADMIN] toggleProvider called with:', provider);
    console.warn('[TTS-ADMIN] Current config:', config);
    
    if (!config) {
      console.error('[TTS-ADMIN] No config available');
      return;
    }
    
    const updatedProviders = config.enabledProviders && config.enabledProviders.includes(provider)
      ? config.enabledProviders.filter(p => p !== provider)
      : [...(config.enabledProviders || []), provider];
    
    // If we're disabling a provider and it's the default, switch default to first enabled provider
    let newDefaultProvider = config.defaultProvider;
    if (!updatedProviders.includes(config.defaultProvider) && updatedProviders.length > 0) {
      newDefaultProvider = updatedProviders[0];
      console.warn('[TTS-ADMIN] Switching default provider from', config.defaultProvider, 'to', newDefaultProvider);
    }
    
    const updatedConfig = { 
      ...config, 
      enabledProviders: updatedProviders,
      defaultProvider: newDefaultProvider
    };
    console.warn('[TTS-ADMIN] Updated config with providers:', updatedConfig);
    setConfig(updatedConfig);
    
    // Auto-save the change
    try {
      setSaving(true);
      console.warn('[TTS-ADMIN] Attempting to save provider config...');
      
      const authToken = localStorage.getItem('authToken');
      console.warn('[TTS-ADMIN] Auth token present:', !!authToken);
      
      const sanitizedConfig = {
        ...updatedConfig,
        // Numeric fields with proper defaults from database schema
        defaultRate: typeof updatedConfig.defaultRate === 'number' && !isNaN(updatedConfig.defaultRate) ? updatedConfig.defaultRate : 1.00,
        minRate: typeof updatedConfig.minRate === 'number' && !isNaN(updatedConfig.minRate) ? updatedConfig.minRate : 0.80,
        maxRate: typeof updatedConfig.maxRate === 'number' && !isNaN(updatedConfig.maxRate) ? updatedConfig.maxRate : 1.25,
        chunkMinChars: typeof updatedConfig.chunkMinChars === 'number' && !isNaN(updatedConfig.chunkMinChars) ? updatedConfig.chunkMinChars : 400,
        chunkMaxChars: typeof updatedConfig.chunkMaxChars === 'number' && !isNaN(updatedConfig.chunkMaxChars) ? updatedConfig.chunkMaxChars : 1800,
        mp3Bitrate: typeof updatedConfig.mp3Bitrate === 'number' && !isNaN(updatedConfig.mp3Bitrate) ? updatedConfig.mp3Bitrate : 64,
        queueConcurrency: typeof updatedConfig.queueConcurrency === 'number' && !isNaN(updatedConfig.queueConcurrency) ? updatedConfig.queueConcurrency : 1,
        cacheMaxGb: typeof updatedConfig.cacheMaxGb === 'number' && !isNaN(updatedConfig.cacheMaxGb) ? updatedConfig.cacheMaxGb : 20,
        cacheTtlDays: typeof updatedConfig.cacheTtlDays === 'number' && !isNaN(updatedConfig.cacheTtlDays) ? updatedConfig.cacheTtlDays : 90,
        // String fields with defaults
        defaultLang: typeof updatedConfig.defaultLang === 'string' ? updatedConfig.defaultLang : 'en',
        defaultVoiceRu: typeof updatedConfig.defaultVoiceRu === 'string' ? updatedConfig.defaultVoiceRu : '',
        defaultVoiceEn: typeof updatedConfig.defaultVoiceEn === 'string' ? updatedConfig.defaultVoiceEn : '',
        audioFormat: typeof updatedConfig.audioFormat === 'string' ? updatedConfig.audioFormat : 'mp3',
        rhvoiceBinPath: typeof updatedConfig.rhvoiceBinPath === 'string' ? updatedConfig.rhvoiceBinPath : '',
        piperBinPath: typeof updatedConfig.piperBinPath === 'string' ? updatedConfig.piperBinPath : '',
        piperModelsDir: typeof updatedConfig.piperModelsDir === 'string' ? updatedConfig.piperModelsDir : '',
        // Array field with default
        enabledProviders: Array.isArray(updatedConfig.enabledProviders) ? updatedConfig.enabledProviders : ['rhvoice', 'piper'],
        // String field with default
        defaultProvider: typeof updatedConfig.defaultProvider === 'string' && updatedConfig.defaultProvider !== '' ? updatedConfig.defaultProvider : 'windows',
        // Boolean field
        ttsEnabled: Boolean(updatedConfig.ttsEnabled)
      };
      
      console.warn('[TTS-ADMIN] Sanitized provider config to send:', sanitizedConfig);
      console.warn('[TTS-ADMIN] ttsEnabled in provider config:', sanitizedConfig.ttsEnabled);
      
      const response = await fetch('/api/tts/admin/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sanitizedConfig)
      });
      
      console.warn('[TTS-ADMIN] Provider API response status:', response.status);
      
      if (response.ok) {
        console.warn('[TTS-ADMIN] ✅ Provider settings saved successfully');
        toast({
          title: t('common:success'),
          description: 'Настройки провайдера сохранены'
        });
        // Don't fetchConfig here since we already have the updated state
        // The local state is already correct, no need to reload from server
      } else {
        const errorText = await response.text();
        console.error('[TTS-ADMIN] ❌ Failed to save provider settings:', response.status, errorText);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('[TTS-ADMIN] Error saving provider settings:', error);
      toast({
        variant: 'destructive',
        title: t('common:error'),
        description: error instanceof Error ? error.message : 'Не удалось сохранить настройки провайдера'
      });
      // Only revert if save actually failed, not on network errors
      // The local state change should persist unless there's a real error
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t('common:loading')}</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p>Не удалось загрузить конфигурацию TTS</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Настройки TTS</h1>
          <p className="text-muted-foreground mt-2">
            Управление настройками синтеза речи и провайдерами
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={clearCache} variant="outline">
            <Trash2 className="w-4 h-4 mr-2" />
            Очистить кэш
          </Button>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Сохранить изменения'
            )}
          </Button>
        </div>
      </div>

      {/* Cache Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Статистика кэша
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Общий размер</p>
              <p className="text-2xl font-bold">{cacheStats.sizeGb.toFixed(2)} GB</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Аудиофайлы</p>
              <p className="text-2xl font-bold">{cacheStats.fileCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Основные настройки</CardTitle>
          <CardDescription>
            Базовая конфигурация системы TTS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Включить систему TTS</Label>
              <p className="text-sm text-muted-foreground">
                Включение/выключение всей функциональности TTS
              </p>
            </div>
            <Switch
              checked={Boolean(config?.ttsEnabled)}
              onCheckedChange={(checked) => {
                console.log('=== SWITCH EVENT TRIGGERED ===');
                console.log('Switch value changed to:', checked);
                console.log('Current config.ttsEnabled:', config?.ttsEnabled);
                console.log('Full config object:', config);
                toggleTtsEnabled(checked);
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Провайдер по умолчанию</Label>
              <Select
                value={config.defaultProvider}
                onValueChange={(value) => setConfig({ ...config, defaultProvider: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piper">Piper</SelectItem>
                  <SelectItem value="rhvoice">RHVoice</SelectItem>
                  <SelectItem value="mimikastudio">MimikaStudio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Язык по умолчанию</Label>
              <Select
                value={typeof config.defaultLang === 'string' ? config.defaultLang : 'en'}
                onValueChange={(value) => setConfig({ ...config, defaultLang: value })}
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
          </div>

          <div className="space-y-2">
            <Label>Скорость по умолчанию: {(typeof config.defaultRate === 'number' ? config.defaultRate : 1.0).toFixed(2)}x</Label>
            <Slider
              value={[typeof config.defaultRate === 'number' ? config.defaultRate : 1.0]}
              onValueChange={([value]) => setConfig({ ...config, defaultRate: Number(value) })}
              min={typeof config.minRate === 'number' ? config.minRate : 0.5}
              max={typeof config.maxRate === 'number' ? config.maxRate : 2.0}
              step={0.05}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Мин: {(typeof config.minRate === 'number' ? config.minRate : 0.5).toFixed(2)}x</span>
              <span>Макс: {(typeof config.maxRate === 'number' ? config.maxRate : 2.0).toFixed(2)}x</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Настройка провайдеров</CardTitle>
          <CardDescription>
            Включение/выключение провайдеров TTS и настройка их параметров
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="text-base">Piper</Label>
                <p className="text-sm text-muted-foreground">
                  Нейронный движок TTS с высококачественными голосами
                </p>
              </div>
              <Switch
                checked={config.enabledProviders && config.enabledProviders.includes('piper')}
                onCheckedChange={() => toggleProvider('piper')}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="text-base">RHVoice</Label>
                <p className="text-sm text-muted-foreground">
                  Открытый синтезатор речи
                </p>
              </div>
              <Switch
                checked={config.enabledProviders && config.enabledProviders.includes('rhvoice')}
                onCheckedChange={() => toggleProvider('rhvoice')}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="text-base">MimikaStudio</Label>
                <p className="text-sm text-muted-foreground">
                  Продвинутый движок TTS с возможностью клонирования голоса
                </p>
              </div>
              <Switch
                checked={config.enabledProviders && config.enabledProviders.includes('mimikastudio')}
                onCheckedChange={() => toggleProvider('mimikastudio')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Путь к бинарному файлу Piper</Label>
              <Input
                value={typeof config.piperBinPath === 'string' ? config.piperBinPath : ''}
                onChange={(e) => setConfig({ ...config, piperBinPath: e.target.value })}
                placeholder="/usr/local/bin/piper"
              />
            </div>
            <div className="space-y-2">
              <Label>Директория моделей Piper</Label>
              <Input
                value={typeof config.piperModelsDir === 'string' ? config.piperModelsDir : ''}
                onChange={(e) => setConfig({ ...config, piperModelsDir: e.target.value })}
                placeholder="/opt/piper/models"
              />
            </div>
            <div className="space-y-2">
              <Label>Путь к бинарному файлу RHVoice</Label>
              <Input
                value={typeof config.rhvoiceBinPath === 'string' ? config.rhvoiceBinPath : ''}
                onChange={(e) => setConfig({ ...config, rhvoiceBinPath: e.target.value })}
                placeholder="/usr/bin/RHVoice-test"
              />
            </div>
            <div className="space-y-2">
              <Label>API URL MimikaStudio</Label>
              <Input
                value={typeof config.mimikaStudioApiUrl === 'string' ? config.mimikaStudioApiUrl : ''}
                onChange={(e) => setConfig({ ...config, mimikaStudioApiUrl: e.target.value })}
                placeholder="http://localhost:8000"
              />
            </div>
            <div className="space-y-2">
              <Label>API ключ MimikaStudio</Label>
              <Input
                value={typeof config.mimikaStudioApiKey === 'string' ? config.mimikaStudioApiKey : ''}
                onChange={(e) => setConfig({ ...config, mimikaStudioApiKey: e.target.value })}
                placeholder="API ключ (необязательно)"
              />
            </div>
            <div className="space-y-2">
              <Label>Директория моделей MimikaStudio</Label>
              <Input
                value={typeof config.mimikaStudioModelsDir === 'string' ? config.mimikaStudioModelsDir : ''}
                onChange={(e) => setConfig({ ...config, mimikaStudioModelsDir: e.target.value })}
                placeholder="C:\opt\mimikastudio\models"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Производительность и ограничения</CardTitle>
          <CardDescription>
            Настройка производительности системы и ограничений ресурсов
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Параллелизм очереди</Label>
              <Input
                type="number"
                min="1"
                max="4"
                value={config.queueConcurrency}
                onChange={(e) => setConfig({ ...config, queueConcurrency: Number(e.target.value) || 1 })}
              />
              <p className="text-sm text-muted-foreground">
                Количество одновременных задач синтеза (1-4)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Формат аудио</Label>
              <Select
                value={typeof config.audioFormat === 'string' ? config.audioFormat : 'mp3'}
                onValueChange={(value) => setConfig({ ...config, audioFormat: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="ogg">OGG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Битрейт MP3 (кбит/с)</Label>
              <Input
                type="number"
                min="32"
                max="320"
                value={config.mp3Bitrate}
                onChange={(e) => setConfig({ ...config, mp3Bitrate: Number(e.target.value) || 64 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Лимит размера кэша (ГБ)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={config.cacheMaxGb}
                onChange={(e) => setConfig({ ...config, cacheMaxGb: Number(e.target.value) || 20 })}
              />
            </div>

            <div className="space-y-2">
              <Label>TTL кэша (дни)</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={config.cacheTtlDays}
                onChange={(e) => setConfig({ ...config, cacheTtlDays: Number(e.target.value) || 90 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Text Chunking */}
      <Card>
        <CardHeader>
          <CardTitle>Разделение текста</CardTitle>
          <CardDescription>
            Настройка разделения текста для синтеза
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Минимальный размер фрагмента (символов)</Label>
              <Input
                type="number"
                min="100"
                max="1000"
                value={config.chunkMinChars}
                onChange={(e) => setConfig({ ...config, chunkMinChars: Number(e.target.value) || 400 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Максимальный размер фрагмента (символов)</Label>
              <Input
                type="number"
                min="1000"
                max="5000"
                value={config.chunkMaxChars}
                onChange={(e) => setConfig({ ...config, chunkMaxChars: Number(e.target.value) || 1800 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Диапазон скорости</Label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-sm">Мин: {(typeof config.minRate === 'number' ? config.minRate : 0.5).toFixed(2)}x</Label>
                <Slider
                  value={[typeof config.minRate === 'number' ? config.minRate : 0.5]}
                  onValueChange={([value]) => setConfig({ ...config, minRate: Number(value) })}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <Label className="text-sm">Макс: {(typeof config.maxRate === 'number' ? config.maxRate : 2.0).toFixed(2)}x</Label>
                <Slider
                  value={[typeof config.maxRate === 'number' ? config.maxRate : 2.0]}
                  onValueChange={([value]) => setConfig({ ...config, maxRate: Number(value) })}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TtsAdminSettings;