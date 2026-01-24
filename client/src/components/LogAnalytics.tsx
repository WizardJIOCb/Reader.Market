import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Download, 
  Filter, 
  BarChart3, 
  Activity, 
  AlertTriangle,
  Info,
  Bug,
  Calendar,
  User,
  Users,
  Server,
  Database,
  Wifi,
  Hash
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  source: 'frontend' | 'backend' | 'database' | 'websocket';
  module: string;
  message: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  parentId?: string;
  ipAddress?: string;
  userAgent?: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

interface LogStats {
  totalLogs: number;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
  byModule: Record<string, number>;
  recentErrors: number;
  avgLogsPerHour: number;
}

interface LogSearchResult {
  logs: LogEntry[];
  totalCount: number;
  stats: LogStats;
  pagination: {
    limit: number;
    offset: number;
    totalCount: number;
  };
}

interface LogFilters {
  level: string[];
  source: string[];
  module: string[];
  userId?: string;
  sessionId?: string;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}

const LogLevelBadge = ({ level }: { level: string }) => {
  const levelConfig = {
    error: { variant: 'destructive', icon: AlertTriangle },
    warn: { variant: 'warning', icon: AlertTriangle },
    info: { variant: 'default', icon: Info },
    debug: { variant: 'secondary', icon: Bug }
  };
  
  const config = levelConfig[level as keyof typeof levelConfig] || levelConfig.info;
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant as any}>
      <Icon className="w-3 h-3 mr-1" />
      {level.toUpperCase()}
    </Badge>
  );
};

const LogSourceIcon = ({ source }: { source: string }) => {
  const sourceIcons = {
    frontend: User,
    backend: Server,
    database: Database,
    websocket: Wifi
  };
  
  const Icon = sourceIcons[source as keyof typeof sourceIcons] || Server;
  
  return <Icon className="w-4 h-4" />;
};

export function LogAnalytics() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [filters, setFilters] = useState<LogFilters>({
    level: [],
    source: [],
    module: [],
    searchTerm: ''
  });
  const [chainResults, setChainResults] = useState<LogEntry[]>([]);
  const [chainSearch, setChainSearch] = useState({
    correlationId: '',
    sessionId: '',
    userId: '',
    userHours: 24,
    errorLogId: '',
    beforeMinutes: 5,
    afterMinutes: 5,
    requestPath: '',
    requestMethod: '',
    requestHours: 1
  });
  const [chainLoading, setChainLoading] = useState(false);
  const [chainSearchPerformed, setChainSearchPerformed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, totalCount: 0 });
  const [activeTab, setActiveTab] = useState('search');

  // Load initial data
  useEffect(() => {
    loadStats();
    searchLogs();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/logs/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const searchLogs = async (newFilters: Partial<LogFilters> = {}, newOffset = 0) => {
    setLoading(true);
    try {
      const searchParams = {
        ...filters,
        ...newFilters,
        offset: newOffset,
        limit: pagination.limit
      };

      // Add date range filtering if dates are provided
      if (filters.startDate) {
        searchParams.startDate = new Date(filters.startDate).toISOString();
      }
      if (filters.endDate) {
        searchParams.endDate = new Date(filters.endDate).toISOString();
      }

      const response = await fetch('/api/admin/logs/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(searchParams)
      });

      if (response.ok) {
        const data: LogSearchResult = await response.json();
        setLogs(data.logs);
        setPagination({
          limit: data.pagination.limit,
          offset: data.pagination.offset,
          totalCount: data.pagination.totalCount
        });
      } else {
        toast({
          title: "Search Failed",
          description: "Failed to search logs",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Failed to connect to server",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch('/api/admin/logs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          format,
          filters
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-export-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export Successful",
          description: `Logs exported as ${format.toUpperCase()}`
        });
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export logs",
        variant: "destructive"
      });
    }
  };

  const handleFilterChange = (key: keyof LogFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    searchLogs(newFilters, 0);
  };

  const handlePageChange = (newOffset: number) => {
    searchLogs({}, newOffset);
  };

  const clearFilters = () => {
    const clearedFilters = {
      level: [],
      source: [],
      module: [],
      searchTerm: ''
    };
    setFilters(clearedFilters);
    searchLogs(clearedFilters, 0);
  };

  const searchChain = async (type: string, ...params: any[]) => {
    setChainLoading(true);
    setChainSearchPerformed(true);
    
    try {
      let url = '';
      
      switch (type) {
        case 'correlation':
          url = `/api/admin/logs/chain/correlation/${params[0]}`;
          break;
        case 'session':
          url = `/api/admin/logs/chain/session/${params[0]}`;
          break;
        case 'user':
          url = `/api/admin/logs/chain/user/${params[0]}?hours=${params[1] || 24}`;
          break;
        case 'error':
          url = `/api/admin/logs/error/${params[0]}/context?before=${params[1] || 5}&after=${params[2] || 5}`;
          break;
        case 'request':
          url = `/api/admin/logs/request-flow?path=${encodeURIComponent(params[0])}&method=${params[1]}&hours=${params[2] || 1}`;
          break;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setChainResults(data.logs || []);
      } else {
        toast({
          title: "Chain Search Failed",
          description: "Failed to retrieve call chain",
          variant: "destructive"
        });
        setChainResults([]);
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Failed to connect to server",
        variant: "destructive"
      });
      setChainResults([]);
    } finally {
      setChainLoading(false);
    }
  };

  const clearChainResults = () => {
    setChainResults([]);
    setChainSearchPerformed(false);
  };

  const getLevelStats = () => {
    if (!stats) return [];
    return Object.entries(stats.byLevel)
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getSourceStats = () => {
    if (!stats) return [];
    return Object.entries(stats.bySource)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Log Analytics</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportLogs('json')}>
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLogs('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search">Search Logs</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="chains">Call Chains</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          {/* Quick Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Quick Search Presets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'All Errors', filters: { level: ['error'] } },
                  { label: 'Warnings Only', filters: { level: ['warn'] } },
                  { label: 'Auth Related', filters: { searchTerm: 'login|register|auth|jwt|signin|signup' } },
                  { label: 'Book Operations', filters: { searchTerm: 'book|books|reading|progress' } },
                  { label: 'API Requests', filters: { source: ['backend'], module: ['http-request'] } },
                  { label: 'Database Queries', filters: { source: ['database'] } },
                  { label: 'Frontend Issues', filters: { source: ['frontend'], level: ['error', 'warn'] } },
                  { label: 'Recent Activity', filters: { searchTerm: '' }, hours: 1 }
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newFilters = {...filters, ...preset.filters};
                      if (preset.hours) {
                        // For recent activity, we'd need to add date filtering
                        console.log(`Would filter last ${preset.hours} hours`);
                      }
                      setFilters(newFilters);
                      searchLogs(newFilters);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search Term */}
                <div className="space-y-2">
                  <Label htmlFor="search-term">Search Term</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search-term"
                      placeholder="Search in log messages..."
                      className="pl-10"
                      value={filters.searchTerm || ''}
                      onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                    />
                  </div>
                </div>

                {/* Level Filter */}
                <div className="space-y-2">
                  <Label>Log Levels</Label>
                  <div className="space-y-1">
                    {['error', 'warn', 'info', 'debug'].map(level => (
                      <div key={level} className="flex items-center space-x-2">
                        <Checkbox
                          id={`level-${level}`}
                          checked={filters.level.includes(level)}
                          onCheckedChange={(checked) => {
                            const newLevels = checked
                              ? [...filters.level, level]
                              : filters.level.filter(l => l !== level);
                            handleFilterChange('level', newLevels);
                          }}
                        />
                        <Label htmlFor={`level-${level}`} className="capitalize">
                          {level}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source Filter */}
                <div className="space-y-2">
                  <Label>Log Sources</Label>
                  <div className="space-y-1">
                    {['frontend', 'backend', 'database', 'websocket'].map(source => (
                      <div key={source} className="flex items-center space-x-2">
                        <Checkbox
                          id={`source-${source}`}
                          checked={filters.source.includes(source)}
                          onCheckedChange={(checked) => {
                            const newSources = checked
                              ? [...filters.source, source]
                              : filters.source.filter(s => s !== source);
                            handleFilterChange('source', newSources);
                          }}
                        />
                        <Label htmlFor={`source-${source}`} className="capitalize flex items-center gap-1">
                          <LogSourceIcon source={source} />
                          {source}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User/Session Filters */}
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input
                    placeholder="Filter by user ID"
                    value={filters.userId || ''}
                    onChange={(e) => handleFilterChange('userId', e.target.value)}
                  />
                  
                  <Label className="mt-2">Session ID</Label>
                  <Input
                    placeholder="Filter by session ID"
                    value={filters.sessionId || ''}
                    onChange={(e) => handleFilterChange('sessionId', e.target.value)}
                  />
                </div>

                {/* Date Range Filters */}
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="start-date" className="text-xs">From</Label>
                      <Input
                        id="start-date"
                        type="datetime-local"
                        value={filters.startDate || ''}
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-xs">To</Label>
                      <Input
                        id="end-date"
                        type="datetime-local"
                        value={filters.endDate || ''}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={clearFilters}>
                  Clear All Filters
                </Button>
                <div className="text-sm text-muted-foreground">
                  Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.totalCount)} of {pagination.totalCount} logs
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Log Results */}
          <Card>
            <CardHeader>
              <CardTitle>Log Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No logs found matching your criteria
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map(log => (
                    <div 
                      key={log.id} 
                      className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-wrap">
                          <LogLevelBadge level={log.level} />
                          <LogSourceIcon source={log.source} />
                          <span className="font-mono text-sm">{log.module}</span>
                          
                          {/* Clickable User ID badge */}
                          {log.userId && (
                            <Badge 
                              variant="outline" 
                              className="cursor-pointer hover:bg-primary/10 transition-colors"
                              onClick={() => {
                                setFilters({...filters, userId: log.userId});
                                searchLogs({...filters, userId: log.userId}, 0);
                              }}
                            >
                              <User className="w-3 h-3 mr-1" />
                              User: {log.userId.substring(0, 8)}...
                            </Badge>
                          )}
                          
                          {/* Clickable Session ID badge */}
                          {log.sessionId && (
                            <Badge 
                              variant="outline" 
                              className="cursor-pointer hover:bg-primary/10 transition-colors"
                              onClick={() => {
                                setFilters({...filters, sessionId: log.sessionId});
                                searchLogs({...filters, sessionId: log.sessionId}, 0);
                              }}
                            >
                              <Activity className="w-3 h-3 mr-1" />
                              Session: {log.sessionId.substring(0, 8)}...
                            </Badge>
                          )}
                          
                          {/* Clickable Correlation ID badge */}
                          {log.correlationId && (
                            <Badge 
                              variant="outline" 
                              className="cursor-pointer hover:bg-primary/10 transition-colors"
                              onClick={() => {
                                // Search by correlation ID in chain analysis
                                searchChain('correlation', log.correlationId);
                                setActiveTab('chains');
                              }}
                            >
                              <Hash className="w-3 h-3 mr-1" />
                              Correlation: {log.correlationId.substring(0, 8)}...
                            </Badge>
                          )}
                          
                          {/* Clickable Module badge */}
                          <Badge 
                            variant="secondary" 
                            className="cursor-pointer hover:bg-secondary/80 transition-colors"
                            onClick={() => {
                              const newModules = filters.module.includes(log.module) 
                                ? filters.module 
                                : [...filters.module, log.module];
                              setFilters({...filters, module: newModules});
                              searchLogs({...filters, module: newModules}, 0);
                            }}
                          >
                            <Server className="w-3 h-3 mr-1" />
                            {log.module}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm">
                        {log.message}
                      </div>
                      
                      {log.metadata && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Metadata ({Object.keys(log.metadata).length} items)
                          </summary>
                          <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}

                  {/* Pagination */}
                  {pagination.totalCount > pagination.limit && (
                    <div className="flex justify-between items-center mt-6 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                        disabled={pagination.offset === 0}
                      >
                        Previous
                      </Button>
                      
                      <div className="text-sm text-muted-foreground">
                        Page {Math.floor(pagination.offset / pagination.limit) + 1} of {Math.ceil(pagination.totalCount / pagination.limit)}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                        disabled={pagination.offset + pagination.limit >= pagination.totalCount}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {stats && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{stats.recentErrors}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Logs/Hour</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.avgLogsPerHour}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Object.keys(stats.byModule).length}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Level */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Logs by Level
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getLevelStats().map(({ level, count }) => (
                        <div key={level} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LogLevelBadge level={level} />
                            <span className="capitalize">{level}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{count}</span>
                            <div 
                              className="h-2 bg-muted rounded-full flex-1 max-w-32"
                              style={{ 
                                background: `linear-gradient(to right, hsl(var(--${level === 'error' ? 'destructive' : level === 'warn' ? 'warning' : 'primary'})), transparent ${100 - (count / Math.max(...Object.values(stats.byLevel)) * 100)}%)` 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* By Source */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      Logs by Source
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getSourceStats().map(({ source, count }) => (
                        <div key={source} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LogSourceIcon source={source} />
                            <span className="capitalize">{source}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{count}</span>
                            <div 
                              className="h-2 bg-muted rounded-full flex-1 max-w-32"
                              style={{ 
                                background: `linear-gradient(to right, hsl(var(--primary)), transparent ${100 - (count / Math.max(...Object.values(stats.bySource)) * 100)}%)` 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Log Trends (Coming Soon)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4" />
                <p>Historical log trend analysis will be available soon</p>
                <p className="text-sm mt-2">This will show log volume patterns over time</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chains" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Call Chain Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Presets for Common Operations */}
              <div className="border-b pb-6">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Quick Presets
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {[
                    { name: 'Authentication', searchTerm: 'login|register|auth|jwt|signin|signup', color: 'blue' },
                    { name: 'Books', searchTerm: 'book|books|reading|progress|library', color: 'green' },
                    { name: 'Shelves', searchTerm: 'shelf|shelves|collection', color: 'purple' },
                    { name: 'Users', searchTerm: 'user|profile|account|me', color: 'orange' },
                    { name: 'Comments', searchTerm: 'comment|reply|discussion', color: 'yellow' },
                    { name: 'Reviews', searchTerm: 'review|rating|feedback', color: 'red' },
                    { name: 'Messages', searchTerm: 'message|chat|conversation', color: 'indigo' },
                    { name: 'News', searchTerm: 'news|article|blog', color: 'pink' },
                    { name: 'Translations', searchTerm: 'translation|translate|locale', color: 'teal' },
                    { name: 'Search', searchTerm: 'search|find|query', color: 'cyan' },
                    { name: 'Uploads', searchTerm: 'upload|file|attachment', color: 'lime' },
                    { name: 'Database', searchTerm: 'database|db|query|sql', color: 'gray' }
                  ].map((preset) => (
                    <Button
                      key={preset.name}
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        setFilters({...filters, searchTerm: preset.searchTerm});
                        searchLogs({...filters, searchTerm: preset.searchTerm});
                      }}
                    >
                      <div className={`w-2 h-2 rounded-full mr-2 bg-${preset.color}-500`} />
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Chain Search Methods */}
              <div className="border-b pb-6">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  API Endpoint Presets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { name: 'User Auth Endpoints', path: '/api/auth', method: 'POST' },
                    { name: 'User Profile', path: '/api/profile', method: 'GET' },
                    { name: 'Book CRUD', path: '/api/books', method: 'ANY' },
                    { name: 'Shelf Management', path: '/api/shelves', method: 'ANY' },
                    { name: 'Comments System', path: '/api/comments', method: 'ANY' },
                    { name: 'Reviews System', path: '/api/reviews', method: 'ANY' },
                    { name: 'Messaging', path: '/api/messages', method: 'ANY' },
                    { name: 'News Feed', path: '/api/news', method: 'ANY' },
                    { name: 'Search API', path: '/api/search', method: 'GET' },
                    { name: 'Admin APIs', path: '/api/admin', method: 'ANY' }
                  ].map((endpoint) => (
                    <Button
                      key={endpoint.name}
                      variant="secondary"
                      size="sm"
                      className="justify-between"
                      onClick={() => searchChain('request', endpoint.path, endpoint.method, 24)}
                    >
                      <span>{endpoint.name}</span>
                      <Badge variant="outline" className="ml-2">
                        {endpoint.method} {endpoint.path}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* By Correlation ID */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    By Correlation ID
                  </h3>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter correlation ID" 
                      value={chainSearch.correlationId}
                      onChange={(e) => setChainSearch({...chainSearch, correlationId: e.target.value})}
                    />
                    <Button 
                      onClick={() => searchChain('correlation', chainSearch.correlationId)}
                      disabled={!chainSearch.correlationId}
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* By Session ID */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    By Session ID
                  </h3>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter session ID" 
                      value={chainSearch.sessionId}
                      onChange={(e) => setChainSearch({...chainSearch, sessionId: e.target.value})}
                    />
                    <Button 
                      onClick={() => searchChain('session', chainSearch.sessionId)}
                      disabled={!chainSearch.sessionId}
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* By User ID */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    By User ID
                  </h3>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Enter user ID" 
                        value={chainSearch.userId}
                        onChange={(e) => setChainSearch({...chainSearch, userId: e.target.value})}
                      />
                      <Select 
                        value={chainSearch.userHours.toString()} 
                        onValueChange={(value) => setChainSearch({...chainSearch, userHours: parseInt(value)})}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1h</SelectItem>
                          <SelectItem value="6">6h</SelectItem>
                          <SelectItem value="12">12h</SelectItem>
                          <SelectItem value="24">24h</SelectItem>
                          <SelectItem value="48">48h</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={() => searchChain('user', chainSearch.userId, chainSearch.userHours)}
                      disabled={!chainSearch.userId}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Search User Chain
                    </Button>
                  </div>
                </div>

                {/* Error Context */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Error Context
                  </h3>
                  <div className="space-y-2">
                    <Input 
                      placeholder="Enter error log ID" 
                      value={chainSearch.errorLogId}
                      onChange={(e) => setChainSearch({...chainSearch, errorLogId: e.target.value})}
                    />
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        placeholder="Minutes before" 
                        value={chainSearch.beforeMinutes}
                        onChange={(e) => setChainSearch({...chainSearch, beforeMinutes: parseInt(e.target.value) || 5})}
                        className="w-24"
                      />
                      <Input 
                        type="number" 
                        placeholder="Minutes after" 
                        value={chainSearch.afterMinutes}
                        onChange={(e) => setChainSearch({...chainSearch, afterMinutes: parseInt(e.target.value) || 5})}
                        className="w-24"
                      />
                    </div>
                    <Button 
                      onClick={() => searchChain('error', chainSearch.errorLogId, chainSearch.beforeMinutes, chainSearch.afterMinutes)}
                      disabled={!chainSearch.errorLogId}
                    >
                      <Bug className="w-4 h-4 mr-2" />
                      Get Error Context
                    </Button>
                  </div>
                </div>
              </div>

              {/* Request Flow Search */}
              <div className="border-t pt-6">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Request Flow Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input 
                    placeholder="Path (e.g., /api/books)" 
                    value={chainSearch.requestPath}
                    onChange={(e) => setChainSearch({...chainSearch, requestPath: e.target.value})}
                  />
                  <Select 
                    value={chainSearch.requestMethod} 
                    onValueChange={(value) => setChainSearch({...chainSearch, requestMethod: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={chainSearch.requestHours.toString()} 
                    onValueChange={(value) => setChainSearch({...chainSearch, requestHours: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Hours" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="12">12 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => searchChain('request', chainSearch.requestPath, chainSearch.requestMethod, chainSearch.requestHours)}
                    disabled={!chainSearch.requestPath || !chainSearch.requestMethod}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Analyze Flow
                  </Button>
                </div>
              </div>

              {/* Chain Results */}
              {chainResults.length > 0 && (
                <div className="border-t pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">
                      Chain Results ({chainResults.length} logs)
                    </h3>
                    <Button variant="outline" size="sm" onClick={clearChainResults}>
                      Clear Results
                    </Button>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {chainResults.map((log, index) => (
                      <div 
                        key={log.id} 
                        className="border rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">
                              #{index + 1}
                            </span>
                            <LogLevelBadge level={log.level} />
                            <LogSourceIcon source={log.source} />
                            <span className="font-mono text-sm">{log.module}</span>
                            
                            {/* Clickable Correlation ID in chain */}
                            {log.correlationId && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                                onClick={() => {
                                  searchChain('correlation', log.correlationId);
                                }}
                              >
                                <Hash className="w-3 h-3 mr-1" />
                                {log.correlationId.substring(0, 8)}...
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}
                          </div>
                        </div>
                        
                        <div className="text-sm mb-2">
                          {log.message}
                        </div>
                        
                        {(log.userId || log.sessionId) && (
                          <div className="flex gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                            {log.userId && (
                              <Badge 
                                variant="outline" 
                                className="cursor-pointer hover:bg-primary/10 transition-colors"
                                onClick={() => {
                                  setFilters({...filters, userId: log.userId});
                                  searchLogs({...filters, userId: log.userId}, 0);
                                  setActiveTab('search');
                                }}
                              >
                                <User className="w-3 h-3 mr-1" />
                                User: {log.userId.substring(0, 8)}...
                              </Badge>
                            )}
                            {log.sessionId && (
                              <Badge 
                                variant="outline" 
                                className="cursor-pointer hover:bg-primary/10 transition-colors"
                                onClick={() => {
                                  setFilters({...filters, sessionId: log.sessionId});
                                  searchLogs({...filters, sessionId: log.sessionId}, 0);
                                  setActiveTab('search');
                                }}
                              >
                                <Activity className="w-3 h-3 mr-1" />
                                Session: {log.sessionId.substring(0, 8)}...
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        {log.metadata && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground">
                              Metadata ({Object.keys(log.metadata).length} items)
                            </summary>
                            <pre className="mt-1 bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {chainLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Analyzing call chain...</p>
                </div>
              )}

              {!chainLoading && chainResults.length === 0 && chainSearchPerformed && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No related logs found for the specified criteria</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}