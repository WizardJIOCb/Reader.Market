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