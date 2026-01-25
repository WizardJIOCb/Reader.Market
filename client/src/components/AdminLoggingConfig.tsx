import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLoggerConfig, loggerFactory, DEFAULT_LOGGING_CONFIG, type LoggingConfig, type LoggingModuleConfig } from '@/lib/loggingConfig';
import { Download, Upload, RotateCcw, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ModuleConfigProps {
  moduleName: string;
  displayName: string;
  description: string;
  config: any;
  onUpdate: (enabled: boolean, level: string) => void;
}

const ModuleConfigRow = ({ moduleName, displayName, description, config, onUpdate }: ModuleConfigProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-3 border-b border-border last:border-b-0">
      <div className="md:col-span-3">
        <div className="font-medium">{displayName}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      
      <div className="md:col-span-2">
        <div className="flex items-center space-x-2">
          <Switch
            id={`${moduleName}-enabled`}
            checked={config.enabled}
            onCheckedChange={(checked) => onUpdate(checked, config.level)}
          />
          <Label htmlFor={`${moduleName}-enabled`} className="text-sm">
            Enabled
          </Label>
        </div>
      </div>
      
      <div className="md:col-span-3">
        <Label htmlFor={`${moduleName}-level`} className="text-sm mb-1 block">
          Log Level
        </Label>
        <Select
          value={config.level}
          onValueChange={(value) => onUpdate(config.enabled, value)}
        >
          <SelectTrigger id={`${moduleName}-level`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="md:col-span-4 text-sm text-muted-foreground">
        Current: {config.enabled ? 'ON' : 'OFF'} | Level: {config.level}
      </div>
    </div>
  );
};

export function AdminLoggingConfig() {
  const { config, updateConfig, resetConfig, exportConfig, importConfig } = useLoggerConfig();
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  
  // Кнопки управления консольным выводом
  const handleEnableConsole = () => {
    localStorage.setItem('debugMode', 'true');
    
    const newConfig = {
      ...config,
      globalEnabled: true,
      globalLevel: 'debug' as const,
      modules: {
        ...config.modules,
        frontend: { ...config.modules.frontend, enabled: true, level: 'debug' as const, showInConsole: true },
        api: { ...config.modules.api, enabled: true, level: 'debug' as const, showInConsole: true },
        websocket: { ...config.modules.websocket, enabled: true, level: 'debug' as const, showInConsole: true },
        auth: { ...config.modules.auth, enabled: true, level: 'debug' as const, showInConsole: true },
        database: { ...config.modules.database, enabled: true, level: 'debug' as const, showInConsole: true },
        ui: { ...config.modules.ui, enabled: true, level: 'debug' as const, showInConsole: true },
        readingProgress: { ...config.modules.readingProgress, enabled: true, level: 'debug' as const, showInConsole: true },
        books: { ...config.modules.books, enabled: true, level: 'debug' as const, showInConsole: true },
        shelves: { ...config.modules.shelves, enabled: true, level: 'debug' as const, showInConsole: true },
        comments: { ...config.modules.comments, enabled: true, level: 'debug' as const, showInConsole: true },
        reactions: { ...config.modules.reactions, enabled: true, level: 'debug' as const, showInConsole: true },
        fileHandling: { ...config.modules.fileHandling, enabled: true, level: 'debug' as const, showInConsole: true },
        performance: { ...config.modules.performance, enabled: true, level: 'debug' as const, showInConsole: true },
        errors: { ...config.modules.errors, enabled: true, level: 'debug' as const, showInConsole: true },
        userActions: { ...config.modules.userActions, enabled: true, level: 'debug' as const, showInConsole: true }
      }
    };
    
    updateConfig(newConfig);
    
    toast({
      title: "Console Enabled",
      description: "All logs will now appear in browser console"
    });
  };
  
  const handleDisableConsole = () => {
    localStorage.setItem('debugMode', 'false');
    
    const newConfig = {
      ...config,
      globalEnabled: false,
      globalLevel: 'none' as const,
      modules: {
        ...config.modules,
        frontend: { ...config.modules.frontend, enabled: false, level: 'none' as const, showInConsole: false },
        api: { ...config.modules.api, enabled: false, level: 'none' as const, showInConsole: false },
        websocket: { ...config.modules.websocket, enabled: false, level: 'none' as const, showInConsole: false },
        auth: { ...config.modules.auth, enabled: false, level: 'none' as const, showInConsole: false },
        database: { ...config.modules.database, enabled: false, level: 'none' as const, showInConsole: false },
        ui: { ...config.modules.ui, enabled: false, level: 'none' as const, showInConsole: false },
        readingProgress: { ...config.modules.readingProgress, enabled: false, level: 'none' as const, showInConsole: false },
        books: { ...config.modules.books, enabled: false, level: 'none' as const, showInConsole: false },
        shelves: { ...config.modules.shelves, enabled: false, level: 'none' as const, showInConsole: false },
        comments: { ...config.modules.comments, enabled: false, level: 'none' as const, showInConsole: false },
        reactions: { ...config.modules.reactions, enabled: false, level: 'none' as const, showInConsole: false },
        fileHandling: { ...config.modules.fileHandling, enabled: false, level: 'none' as const, showInConsole: false },
        performance: { ...config.modules.performance, enabled: false, level: 'none' as const, showInConsole: false },
        errors: { ...config.modules.errors, enabled: false, level: 'none' as const, showInConsole: false },
        userActions: { ...config.modules.userActions, enabled: false, level: 'none' as const, showInConsole: false }
      }
    };
    
    updateConfig(newConfig);
    
    toast({
      title: "Console Disabled",
      description: "Console logging turned off"
    });
  };
  
  const handleForceRestoreConsole = () => {
    // Радикальное восстановление - обойти все перехватчики
    try {
      // Метод 1: Использовать indirect eval для получения нативной console
      const nativeConsole = (0, eval)('window.console');
      
      // Метод 2: Назначить нативные методы напрямую
      console.log = nativeConsole.log.bind(nativeConsole);
      console.warn = nativeConsole.warn.bind(nativeConsole);
      console.error = nativeConsole.error.bind(nativeConsole);
      console.info = nativeConsole.info.bind(nativeConsole);
      console.debug = nativeConsole.debug.bind(nativeConsole);
      
      // Сохранить для будущего использования
      const win = window as any;
      win._originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
      };
      
      // Тестировать немедленно
      console.log('✅ Force restoration successful!');
      console.error('✅ Error method also working!');
      
      toast({
        title: "Force Console Restore",
        description: "Used eval to bypass all interceptors. Console should now work normally."
      });
      
    } catch (e) {
      // Метод 3: Абсолютный фолбэк - создать полностью новые методы
      try {
        const createNativeMethod = (methodName: string) => {
          return function(...args: any[]) {
            // Использовать iframe для получения нативной console
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            try {
              const nativeMethod = (iframe.contentWindow as any).console[methodName];
              nativeMethod.apply((iframe.contentWindow as any).console, args);
            } finally {
              document.body.removeChild(iframe);
            }
          };
        };
        
        console.log = createNativeMethod('log');
        console.warn = createNativeMethod('warn');
        console.error = createNativeMethod('error');
        console.info = createNativeMethod('info');
        console.debug = createNativeMethod('debug');
        
        const win = window as any;
        win._originalConsole = {
          log: console.log,
          warn: console.warn,
          error: console.error,
          info: console.info,
          debug: console.debug
        };
        
        console.log('✅ iframe-based restoration successful!');
        
        toast({
          title: "Iframe Console Restore",
          description: "Created new methods using iframe sandbox. Should work now."
        });
        
      } catch (iframeError) {
        toast({
          title: "Complete Restore Failed",
          description: "Could not restore any console methods",
          variant: "destructive"
        });
      }
    }
  };
  
  const handleRestoreConsole = () => {
    const win = window as any;
    let restoredCount = 0;
    
    // Получить нативные методы напрямую из window.console
    const getNativeMethod = (methodName: string) => {
      try {
        // Метод 1: Попробовать получить через descriptor
        const descriptor = Object.getOwnPropertyDescriptor(console, methodName);
        if (descriptor && typeof descriptor.value === 'function') {
          return descriptor.value.bind(console);
        }
        
        // Метод 2: Попробовать через Function.prototype.call
        if (typeof console[methodName as keyof Console] === 'function') {
          return Function.prototype.call.bind(console[methodName as keyof Console]);
        }
        
        // Метод 3: Если всё провалилось, создать фолбэк
        return function(...args: any[]) {
          // Использовать indirect eval для обхода перехвата
          try {
            (0, eval)(`console.${methodName}.apply(console, ${JSON.stringify(args)})`);
          } catch {
            // Последний резорт - DOM
            const logEl = document.createElement('div');
            logEl.textContent = `[${methodName.toUpperCase()}] ${args.join(' ')}`;
            logEl.style.cssText = 'position:fixed;top:-1000px;left:-1000px;';
            document.body.appendChild(logEl);
            document.body.removeChild(logEl);
          }
        };
      } catch (e) {
        return function(...args: any[]) {
          // Safe fallback
          const logEl = document.createElement('div');
          logEl.textContent = `[${methodName.toUpperCase()}] ${args.join(' ')}`;
          logEl.style.cssText = 'position:fixed;top:-1000px;left:-1000px;';
          document.body.appendChild(logEl);
          document.body.removeChild(logEl);
        };
      }
    };
    
    // Восстановить каждый метод отдельно
    const methods = ['log', 'warn', 'error', 'info', 'debug'] as const;
    
    methods.forEach(methodName => {
      try {
        const nativeMethod = getNativeMethod(methodName);
        console[methodName] = nativeMethod;
        restoredCount++;
      } catch (e) {
        console.warn(`Failed to restore console.${methodName}:`, e);
      }
    });
    
    // Сохранить восстановленные методы
    win._originalConsole = {
      log: console.log,
      warn: console.warn, 
      error: console.error,
      info: console.info,
      debug: console.debug
    };
    
    // Тестировать восстановление
    try {
      console.log('✅ Console restoration test');
      console.error('✅ Error method working');
    } catch (e) {
      console.warn('Restoration test failed:', e);
    }
    
    toast({
      title: "Console Restoration Attempt",
      description: `Attempted to restore ${methods.length} methods, ${restoredCount} successful`
    });
  };
  
  const handleKillLoggingSystem = () => {
    // Полностью убить систему логгинга и восстановить нативный console
    try {
      // 1. Очистить все настройки
      localStorage.removeItem('debugMode');
      localStorage.removeItem('loggingConfig');
      localStorage.removeItem('loggerFactory');
      
      // 2. Удалить все кастомные свойства
      const win = window as any;
      delete win._originalConsole;
      delete win.loggerFactory;
      delete win.appLogger;
      delete win.toggleDebugMode;
      
      // 3. Получить чистый нативный console через iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      const nativeConsole = (iframe.contentWindow as any).console;
      
      // 4. Полностью заменить window.console
      window.console = nativeConsole;
      
      // 5. Удалить iframe
      document.body.removeChild(iframe);
      
      // 6. Протестировать
      console.log('_NATIVE_CONSOLE_RESTORED_');
      console.error('Native error logging working!');
      
      alert('✅ Logging system killed. Native console restored. Check DevTools console.');
      
      toast({
        title: "Logging System Killed",
        description: "All custom logging removed. Using pure native browser console."
      });
      
    } catch (e) {
      alert(`Kill failed: ${(e as Error).message}`);
    }
  };
  
  const handleGlobalConsoleDisable = () => {
    // Глобальное отключение console для всего сайта
    try {
      // Отключить режим отладки
      localStorage.setItem('debugMode', 'false');
      
      // Полностью заглушить все методы
      console.log = function() {};
      console.warn = function() {};
      console.error = function() {};
      console.info = function() {};
      console.debug = function() {};
      
      // Также заглушить window._originalConsole если есть
      const win = window as any;
      if (win._originalConsole) {
        win._originalConsole.log = function() {};
        win._originalConsole.warn = function() {};
        win._originalConsole.error = function() {};
        win._originalConsole.info = function() {};
        win._originalConsole.debug = function() {};
      }
      
      toast({
        title: "Global Console Disabled",
        description: "All console output suppressed site-wide"
      });
      
    } catch (e) {
      toast({
        title: "Disable Failed",
        description: "Could not disable global console: " + (e as Error).message,
        variant: "destructive"
      });
    }
  };

  const moduleConfigs = [
    {
      name: 'frontend',
      displayName: 'Frontend Collection',
      description: 'Collect logs from browser console and frontend events'
    },
    {
      name: 'api',
      displayName: 'API Layer',
      description: 'REST API requests, responses, and errors'
    },
    {
      name: 'websocket',
      displayName: 'WebSocket',
      description: 'Real-time connection and message logging'
    },
    {
      name: 'auth',
      displayName: 'Authentication',
      description: 'Login, logout, token management'
    },
    {
      name: 'database',
      displayName: 'Database',
      description: 'Database queries and connections'
    },
    {
      name: 'ui',
      displayName: 'UI Components',
      description: 'Component rendering and interactions'
    },
    {
      name: 'readingProgress',
      displayName: 'Reading Progress',
      description: 'Book reading tracking and progress updates'
    },
    {
      name: 'books',
      displayName: 'Books',
      description: 'Book management, uploads, metadata'
    },
    {
      name: 'shelves',
      displayName: 'Shelves',
      description: 'Bookshelf creation and management'
    },
    {
      name: 'comments',
      displayName: 'Comments',
      description: 'Comment creation, replies, moderation'
    },
    {
      name: 'reactions',
      displayName: 'Reactions',
      description: 'Emoji reactions and voting system'
    },
    {
      name: 'fileHandling',
      displayName: 'File Handling',
      description: 'Uploads, downloads, file processing'
    },
    {
      name: 'performance',
      displayName: 'Performance',
      description: 'Timing, metrics, optimization data'
    },
    {
      name: 'errors',
      displayName: 'Error Tracking',
      description: 'Application errors and exceptions'
    },
    {
      name: 'userActions',
      displayName: 'User Actions',
      description: 'User activity and behavior tracking'
    }
  ];

  const handleModuleUpdate = (moduleName: string, enabled: boolean, level: string) => {
    const newConfig = {
      ...config,
      modules: {
        ...config.modules,
        [moduleName]: {
          ...config.modules[moduleName as keyof typeof config.modules],
          enabled,
          level
        }
      }
    };
    updateConfig(newConfig);
  };

  const handleExport = async () => {
    try {
      const configString = await loggerFactory.exportFromServer() || exportConfig();
      navigator.clipboard.writeText(configString).then(() => {
        toast({
          title: "Configuration Exported",
          description: "Logging configuration copied to clipboard"
        });
      }).catch(() => {
        toast({
          title: "Export Failed",
          description: "Could not copy to clipboard",
          variant: "destructive"
        });
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export configuration from server",
        variant: "destructive"
      });
    }
  };

  const handleImport = () => {
    if (importConfig(importText)) {
      toast({
        title: "Configuration Imported",
        description: "Logging configuration updated successfully"
      });
      setImportText('');
      setShowImport(false);
    } else {
      toast({
        title: "Import Failed",
        description: "Invalid configuration format",
        variant: "destructive"
      });
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset to default logging configuration?')) {
      resetConfig();
      toast({
        title: "Configuration Reset",
        description: "Logging configuration restored to defaults"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quick Console Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button onClick={handleEnableConsole} variant="default">
              Enable Console Output
            </Button>
            <Button onClick={handleDisableConsole} variant="secondary">
              Disable Console Output
            </Button>
            <Button onClick={handleForceRestoreConsole} variant="default">
              Force Restore Console
            </Button>
            <Button onClick={handleRestoreConsole} variant="outline">
              Smart Restore Console
            </Button>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button onClick={handleKillLoggingSystem} variant="destructive" size="lg">
                ☠ KILL LOGGING SYSTEM
              </Button>
              <Button onClick={handleGlobalConsoleDisable} variant="secondary" size="lg">
                🔴 DISABLE CONSOLE SITE-WIDE
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              "Kill" completely removes custom logging. "Disable" temporarily suppresses output.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Quick actions to control browser console logging. Use individual module settings below for fine-grained control.
          </p>
        </CardContent>
      </Card>
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Logging Configuration</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowImport(!showImport)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {showImport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Import Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste exported configuration JSON here..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImport(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!importText.trim()}>
                <Save className="w-4 h-4 mr-2" />
                Import Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Global Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="global-enabled" className="text-sm font-medium mb-2 block">
                Global Logging Enabled
              </Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="global-enabled"
                  checked={config.globalEnabled}
                  onCheckedChange={(checked) => updateConfig({
                    ...config,
                    globalEnabled: checked
                  })}
                />
                <Label htmlFor="global-enabled">
                  {config.globalEnabled ? 'Enabled' : 'Disabled'}
                </Label>
              </div>
            </div>
            
            <div>
              <Label htmlFor="global-level" className="text-sm font-medium mb-2 block">
                Global Log Level
              </Label>
              <Select
                value={config.globalLevel}
                onValueChange={(value) => updateConfig({
                  ...config,
                  globalLevel: value as any
                })}
              >
                <SelectTrigger id="global-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-medium mb-2">Current Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Global:</span> 
                <span className={config.globalEnabled ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
                  {config.globalEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Level:</span> 
                <span className="ml-2 font-mono uppercase">{config.globalLevel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Active Modules:</span> 
                <span className="ml-2">
                  {Object.values(config.modules).filter(m => m.enabled).length} of {Object.keys(config.modules).length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Verbose Level:</span> 
                <span className="ml-2">
                  {Object.values(config.modules).filter(m => m.level === 'debug').length} modules
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Module Configuration</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure logging for individual system components
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {moduleConfigs.map((module) => (
              <ModuleConfigRow
                key={module.name}
                moduleName={module.name}
                displayName={module.displayName}
                description={module.description}
                config={config.modules[module.name as keyof typeof config.modules]}
                onUpdate={(enabled, level) => handleModuleUpdate(module.name, enabled, level)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Presets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                // Minimal logging - only errors
                const minimalConfig: LoggingConfig = {
                  ...DEFAULT_LOGGING_CONFIG,
                  globalEnabled: true,
                  globalLevel: 'error',
                  modules: {
                    ...DEFAULT_LOGGING_CONFIG.modules,
                    errors: { enabled: true, level: 'error' }
                  }
                };
                updateConfig(minimalConfig);
              }}
            >
              Minimal (Errors Only)
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => {
                // Standard logging - errors and warnings
                const standardConfig: LoggingConfig = {
                  ...DEFAULT_LOGGING_CONFIG,
                  globalEnabled: true,
                  globalLevel: 'warn',
                  modules: {
                    ...DEFAULT_LOGGING_CONFIG.modules,
                    errors: { enabled: true, level: 'error' },
                    api: { enabled: true, level: 'warn' },
                    auth: { enabled: true, level: 'warn' }
                  }
                };
                updateConfig(standardConfig);
              }}
            >
              Standard (Errors + Warnings)
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => {
                // Development logging - everything except debug
                const devModules = { ...DEFAULT_LOGGING_CONFIG.modules };
                Object.keys(devModules).forEach(key => {
                  devModules[key as keyof typeof devModules] = { 
                    enabled: true, 
                    level: 'info' 
                  };
                });
                
                const devConfig: LoggingConfig = {
                  ...DEFAULT_LOGGING_CONFIG,
                  globalEnabled: true,
                  globalLevel: 'info',
                  modules: devModules
                };
                updateConfig(devConfig);
              }}
            >
              Development (Info Level)
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p><strong>Note:</strong> Changes take effect immediately. The most restrictive setting (global vs module) will be applied.</p>
            <p className="mt-1"><strong>Log Levels:</strong> None &lt; Error &lt; Warning &lt; Info &lt; Debug (most verbose)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}