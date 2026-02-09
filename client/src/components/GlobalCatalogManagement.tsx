import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  BarChart3, 
  Package, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';

interface GlobalCatalogStats {
  totalBooks: number;
  pendingBooks: number;
  processedBooks: number;
  failedBooks: number;
  bootstrapDate: string | null;
}

interface QueueStats {
  totalSize: number;
  pendingSize: number;
  processedToday: number;
  averageSpeed: number; // books per hour
  userSearchQueue: number;
  globalFillQueue: number;
}

interface WorkerStats {
  totalProcessed: number;
  totalErrors: number;
  lastProcessedAt: string | null;
  uptime: string;
  activeSince: string | null;
}

const GlobalCatalogManagement: React.FC = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const [stats, setStats] = useState<GlobalCatalogStats | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkerRunning, setIsWorkerRunning] = useState(false);

  useEffect(() => {
    loadStats();
    // Simulate checking worker status
    setIsWorkerRunning(Math.random() > 0.5); // In real app, check actual status
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Mock data for now - in real implementation, fetch from API
      setStats({
        totalBooks: 1254321,
        pendingBooks: 987654,
        processedBooks: 265667,
        failedBooks: 1000,
        bootstrapDate: '2024-01-15T10:30:00Z'
      });

      setQueueStats({
        totalSize: 54321,
        pendingSize: 43210,
        processedToday: 1234,
        averageSpeed: 45.6,
        userSearchQueue: 3210,
        globalFillQueue: 40000
      });

      setWorkerStats({
        totalProcessed: 12345,
        totalErrors: 12,
        lastProcessedAt: '2024-02-01T15:30:00Z',
        uptime: '72 hours',
        activeSince: '2024-01-30T08:00:00Z'
      });
    } catch (error) {
      console.error('Error loading global catalog stats:', error);
      toast({
        title: t('admin:common.error'),
        description: t('admin:globalCatalog.failedToLoadStats'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartWorker = () => {
    // In real implementation, call API to start worker
    setIsWorkerRunning(true);
    toast({
      title: t('admin:globalCatalog.workerStarted'),
      description: t('admin:globalCatalog.workerStartedDesc')
    });
  };

  const handleStopWorker = () => {
    // In real implementation, call API to stop worker
    setIsWorkerRunning(false);
    toast({
      title: t('admin:globalCatalog.workerStopped'),
      description: t('admin:globalCatalog.workerStoppedDesc')
    });
  };

  const handleRunBootstrap = async () => {
    try {
      // In real implementation, call API to start bootstrap
      toast({
        title: t('admin:globalCatalog.bootstrapStarted'),
        description: t('admin:globalCatalog.bootstrapStartedDesc')
      });
    } catch (error) {
      toast({
        title: t('admin:globalCatalog.bootstrapFailed'),
        description: t('admin:globalCatalog.bootstrapFailedDesc'),
        variant: 'destructive'
      });
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return t('admin:common.never');
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('admin:globalCatalog.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin:globalCatalog.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={isWorkerRunning ? "secondary" : "default"} 
            onClick={isWorkerRunning ? handleStopWorker : handleStartWorker}
          >
            {isWorkerRunning ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                {t('admin:globalCatalog.stopWorker')}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {t('admin:globalCatalog.startWorker')}
              </>
            )}
          </Button>
          <Button onClick={handleRunBootstrap}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('admin:globalCatalog.runBootstrap')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <Tabs defaultValue="catalog" className="space-y-4">
          <TabsList>
            <TabsTrigger value="catalog">{t('admin:globalCatalog.catalogTab')}</TabsTrigger>
            <TabsTrigger value="queues">{t('admin:globalCatalog.queuesTab')}</TabsTrigger>
            <TabsTrigger value="worker">{t('admin:globalCatalog.workerTab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('admin:globalCatalog.totalBooks')}
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.totalBooks?.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin:globalCatalog.allBooks')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('admin:globalCatalog.pendingBooks')}
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.pendingBooks?.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin:globalCatalog.waitingProcessing')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('admin:globalCatalog.processedBooks')}
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.processedBooks?.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin:globalCatalog.successfullyProcessed')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('admin:globalCatalog.failedBooks')}
                  </CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {stats?.failedBooks?.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin:globalCatalog.withErrors')}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin:globalCatalog.processingProgress')}</CardTitle>
                <CardDescription>
                  {t('admin:globalCatalog.progressDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>{t('admin:globalCatalog.completed')}</span>
                    <span>
                      {stats?.processedBooks && stats?.totalBooks 
                        ? `${Math.round((stats.processedBooks / stats.totalBooks) * 100)}%` 
                        : '0%'}
                    </span>
                  </div>
                  <Progress 
                    value={stats?.processedBooks && stats?.totalBooks 
                      ? (stats.processedBooks / stats.totalBooks) * 100 
                      : 0} 
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {t('admin:globalCatalog.processed')} {stats?.processedBooks?.toLocaleString()}
                    </span>
                    <span>
                      {t('admin:globalCatalog.remaining')} {stats?.pendingBooks?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin:globalCatalog.bootstrapInfo')}</CardTitle>
                <CardDescription>
                  {t('admin:globalCatalog.bootstrapDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">{t('admin:globalCatalog.bootstrapDate')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(stats?.bootstrapDate)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{t('admin:globalCatalog.workerStatus')}</h4>
                    <Badge variant={isWorkerRunning ? "default" : "secondary"}>
                      {isWorkerRunning ? t('admin:globalCatalog.running') : t('admin:globalCatalog.stopped')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queues" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {t('admin:globalCatalog.queueOverview')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>{t('admin:globalCatalog.totalQueueSize')}</span>
                      <span className="font-medium">
                        {queueStats?.totalSize?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('admin:globalCatalog.pendingItems')}</span>
                      <span className="font-medium">
                        {queueStats?.pendingSize?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('admin:globalCatalog.processedToday')}</span>
                      <span className="font-medium">
                        {queueStats?.processedToday?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('admin:globalCatalog.averageSpeed')}</span>
                      <span className="font-medium">
                        {queueStats?.averageSpeed ? `${queueStats.averageSpeed.toFixed(1)} ${t('admin:globalCatalog.booksPerHour')}` : '0'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('admin:globalCatalog.queueTypes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        {t('admin:globalCatalog.userSearchQueue')}
                      </span>
                      <span className="font-medium">
                        {queueStats?.userSearchQueue?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-500" />
                        {t('admin:globalCatalog.globalFillQueue')}
                      </span>
                      <span className="font-medium">
                        {queueStats?.globalFillQueue?.toLocaleString() || '0'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin:globalCatalog.recentQueueActivity')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin:globalCatalog.query')}</TableHead>
                      <TableHead>{t('admin:globalCatalog.type')}</TableHead>
                      <TableHead>{t('admin:globalCatalog.priority')}</TableHead>
                      <TableHead>{t('admin:globalCatalog.status')}</TableHead>
                      <TableHead>{t('admin:globalCatalog.added')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Harry Potter and the Philosopher's Stone</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t('admin:globalCatalog.userSearch')}</Badge>
                      </TableCell>
                      <TableCell>95</TableCell>
                      <TableCell>
                        <Badge variant="default">{t('admin:globalCatalog.found')}</Badge>
                      </TableCell>
                      <TableCell>2 minutes ago</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">The Great Gatsby</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t('admin:globalCatalog.userSearch')}</Badge>
                      </TableCell>
                      <TableCell>87</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t('admin:globalCatalog.pending')}</Badge>
                      </TableCell>
                      <TableCell>5 minutes ago</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Classics Collection</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t('admin:globalCatalog.globalFill')}</Badge>
                      </TableCell>
                      <TableCell>10</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{t('admin:globalCatalog.failed')}</Badge>
                      </TableCell>
                      <TableCell>1 hour ago</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Russian Literature 20th Century</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t('admin:globalCatalog.globalFill')}</Badge>
                      </TableCell>
                      <TableCell>5</TableCell>
                      <TableCell>
                        <Badge variant="default">{t('admin:globalCatalog.found')}</Badge>
                      </TableCell>
                      <TableCell>2 hours ago</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="worker" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('admin:globalCatalog.totalProcessed')}
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {workerStats?.totalProcessed?.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin:globalCatalog.sinceStart')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('admin:globalCatalog.totalErrors')}
                  </CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {workerStats?.totalErrors?.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin:globalCatalog.processingErrors')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('admin:globalCatalog.uptime')}
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {workerStats?.uptime || '0h'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin:globalCatalog.currentSession')}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin:globalCatalog.workerInformation')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">{t('admin:globalCatalog.activeSince')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(workerStats?.activeSince)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{t('admin:globalCatalog.lastProcessed')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(workerStats?.lastProcessedAt)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{t('admin:globalCatalog.workerStatus')}</h4>
                    <Badge variant={isWorkerRunning ? "default" : "secondary"}>
                      {isWorkerRunning ? t('admin:globalCatalog.running') : t('admin:globalCatalog.stopped')}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{t('admin:globalCatalog.processingRate')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {queueStats?.averageSpeed ? `${queueStats.averageSpeed.toFixed(1)} ${t('admin:globalCatalog.booksPerHour')}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin:globalCatalog.workerControls')}</CardTitle>
                <CardDescription>
                  {t('admin:globalCatalog.workerControlsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant={isWorkerRunning ? "secondary" : "default"} 
                    onClick={isWorkerRunning ? handleStopWorker : handleStartWorker}
                    className="flex-1"
                  >
                    {isWorkerRunning ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        {t('admin:globalCatalog.stopWorker')}
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {t('admin:globalCatalog.startWorker')}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('admin:globalCatalog.restartWorker')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default GlobalCatalogManagement;