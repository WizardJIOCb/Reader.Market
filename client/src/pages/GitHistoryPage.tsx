import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from '@/lib/auth';

interface Commit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  url: string;
}

interface ActivityData {
  date: string;
  count: number;
  weekday: number;
}

interface Commit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  url: string;
}

export default function GitHistoryPage() {
  const [location, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [cacheUpdateTime, setCacheUpdateTime] = useState<string | null>(null);
  const [isFreshData, setIsFreshData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Language-specific data
  const weekdays = i18n.language === 'ru' 
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const months = i18n.language === 'ru'
    ? ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const titleText = i18n.language === 'ru'
    ? 'Активность коммитов за год'
    : 'Commit Activity Over the Past Year';
  
  const subtitleText = i18n.language === 'ru'
    ? 'Каждый квадрат представляет один день'
    : 'Each square represents one day';
  
  const legendLess = i18n.language === 'ru' ? 'Меньше' : 'Less';
  const legendMore = i18n.language === 'ru' ? 'Больше' : 'More';
  
  const statsTotal = i18n.language === 'ru' ? 'Всего коммитов' : 'Total Commits';
  const statsLast = i18n.language === 'ru' ? 'Последний коммит' : 'Last Commit';
  const statsDays = i18n.language === 'ru' ? 'Дней активности' : 'Active Days';
  
  const pageTitle = i18n.language === 'ru' 
    ? 'История коммитов Git'
    : 'Git Commit History';
  
  const pageSubtitle = i18n.language === 'ru'
    ? 'Репозиторий: WizardJIOCb/Reader.Market'
    : 'Repository: WizardJIOCb/Reader.Market';
  
  const noCommitsTitle = i18n.language === 'ru'
    ? 'Коммиты не найдены'
    : 'No Commits Found';
  
  const noCommitsMessage = i18n.language === 'ru'
    ? 'История коммитов временно недоступна.'
    : 'No commit history is available at the moment.';
  
  const refreshButtonLabel = i18n.language === 'ru'
    ? 'Обновить данные (сбросить кэш)'
    : 'Refresh Data (Clear Cache)';

  useEffect(() => {
    const fetchCommits = async () => {
      try {
        setLoading(true);
        
        // Check if we should bypass cache
        const urlParams = new URLSearchParams(window.location.search);
        const bypassCache = urlParams.get('cache') === 'false';
        
        const response = await fetch(`/api/git-history?template=cool&count=0${bypassCache ? '&cache=false' : ''}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        
        // Extract cache update time from response headers or HTML
        const cacheTimeMatch = html.match(/<!-- Cache updated: ([^>]+) -->/);
        if (cacheTimeMatch) {
          setCacheUpdateTime(cacheTimeMatch[1]);
        }
        
        // Set fresh data flag if cache was bypassed
        if (bypassCache) {
          setIsFreshData(true);
          setLastUpdated(new Date().toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US'));
        }
        
        // Parse HTML to extract commits data
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract commits from the HTML
        const commitElements = doc.querySelectorAll('.commit-card');
        const parsedCommits: Commit[] = [];
        
        commitElements.forEach(element => {
          const hashElement = element.querySelector('.commit-hash');
          const messageElement = element.querySelector('.commit-message');
          const authorElement = element.querySelector('.author-name');
          const dateElement = element.querySelector('.commit-date');
          const linkElement = element.querySelector('.commit-link') as HTMLAnchorElement;
          
          if (hashElement && messageElement && authorElement && dateElement && linkElement) {
            parsedCommits.push({
              hash: hashElement.textContent?.trim() || '',
              message: messageElement.textContent?.trim() || '',
              author: authorElement.textContent?.trim() || '',
              timestamp: dateElement.textContent?.trim() || '',
              url: linkElement.href || ''
            });
          }
        });
        
        setCommits(parsedCommits);
        
        // Generate activity data for graph
        const commitDates = parsedCommits.map(commit => {
          // Convert Russian date format to ISO
          const parts = commit.timestamp.split(', ')[0].split('.');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          return new Date().toISOString().split('T')[0];
        });
        
        const activityMap = new Map<string, number>();
        commitDates.forEach(date => {
          activityMap.set(date, (activityMap.get(date) || 0) + 1);
        });
        
        // Generate last 365 days starting from last Monday
        const dates: ActivityData[] = [];
        const today = new Date();
        
        // Find last Monday
        const lastMonday = new Date(today);
        const daysSinceMonday = (today.getDay() + 6) % 7; // 0=Sunday, 1=Monday, etc.
        lastMonday.setDate(today.getDate() - daysSinceMonday - 364);
        
        // Generate 53 weeks × 7 days = 371 days to ensure full coverage
        for (let i = 0; i < 371; i++) {
          const date = new Date(lastMonday);
          date.setDate(lastMonday.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          dates.push({
            date: dateStr,
            count: activityMap.get(dateStr) || 0,
            weekday: date.getDay() === 0 ? 6 : date.getDay() - 1 // 0=Monday, 6=Sunday
          });
        }
        
        // Take only first 365 days (53 weeks × 7 days)
        setActivityData(dates.slice(0, 371));
        setLastUpdated(new Date().toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US'));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch git history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load commit history');
      } finally {
        setLoading(false);
      }
    };

    fetchCommits();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading commit history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Commit History</h2>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Get color for activity cell based on commit count
  const getActivityColor = (count: number): string => {
    if (count === 0) return '#ebedf0';
    if (count === 1) return '#9be9a8';
    if (count <= 3) return '#40c463';
    if (count <= 6) return '#30a14e';
    return '#216e39';
  };

  // Get month labels
  const getMonthLabels = () => {
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const labels = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      if (date <= today) {
        labels.push({ month: months[date.getMonth()], index: i });
      }
    }
    
    return labels;
  };

  return (
    <div className="w-full bg-[#f5f0e6] min-h-screen" style={{ backgroundColor: '#f5f0e6' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
          <p className="text-gray-600 mb-4">{pageSubtitle}</p>
          {(user?.accessLevel === 'admin' || user?.accessLevel === 'moder') && (
            <button 
              onClick={() => window.location.href = '/git-to-gpt?template=cool&count=150&cache=false'}
              className="px-4 py-2 bg-[#7a9a4a] text-white rounded-md hover:bg-[#6a8a3a] transition-colors text-sm"
            >
              {refreshButtonLabel}
            </button>
          )}
          {isFreshData && lastUpdated && (
            <p className="text-xs text-gray-500 mt-2">
              {i18n.language === 'ru' ? 'Данные обновлены:' : 'Data updated:'} {lastUpdated}
            </p>
          )}
          {cacheUpdateTime && !isFreshData && (
            <p className="text-xs text-gray-500 mt-2">
              {i18n.language === 'ru' ? 'Кэш обновлён:' : 'Cache updated:'} {cacheUpdateTime}
            </p>
          )}
        </div>

        {/* Activity Graph */}
        <div className="bg-[#faf5eb] border border-orange-400 rounded-lg p-6 mb-8 shadow-sm" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{titleText}</h2>
            <p className="text-gray-600">{subtitleText}</p>
          </div>
          
          <div className="flex flex-col items-center">
            {/* Graph header */}
            <div className="flex gap-2 mb-2 w-full max-w-4xl">
              <div className="w-10"></div> {/* Spacer for weekdays */}
              <div className="flex-1"></div>
            </div>
            
            {/* Activity grid */}
            <div className="flex gap-4 w-full max-w-4xl">
              {/* Weekday labels on the left */}
              <div className="w-14 flex flex-col text-xs text-gray-500 gap-1">
                {weekdays.map((day) => (
                  <div key={day} className="h-3 flex items-center justify-end pr-3 text-[10px] leading-none">{day}</div>
                ))}
              </div>
              
              {/* Main grid - 53 columns (weeks) x 7 rows (days) */}
              <div className="flex-1">
                <div className="grid grid-flow-col grid-rows-7 grid-cols-53 gap-x-1 gap-y-1">
                  {activityData.map((day, index) => (
                    <div
                      key={index}
                      className="w-3 h-3 rounded-sm cursor-pointer transition-all hover:scale-110 hover:shadow-sm border border-gray-300"
                      style={{
                        backgroundColor: getActivityColor(day.count)
                      }}
                      title={`${day.date}: ${day.count} ${i18n.language === 'ru' ? 'коммитов' : 'commits'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Month labels below the grid */}
            <div className="flex gap-4 mt-2 w-full max-w-4xl ml-14">
              <div className="flex-1 relative h-5">
                {(() => {
                  const monthPositions = [];
                  const today = new Date();
                  
                  // Find last Monday
                  const lastMonday = new Date(today);
                  const daysSinceMonday = (today.getDay() + 6) % 7;
                  lastMonday.setDate(today.getDate() - daysSinceMonday - 364);
                  
                  // Calculate position for each month
                  for (let i = 0; i < 12; i++) {
                    const monthDate = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
                    if (monthDate <= today) {
                      // Calculate how many days from lastMonday to this month's 1st
                      const daysDiff = Math.floor((monthDate.getTime() - lastMonday.getTime()) / (1000 * 60 * 60 * 24));
                      const weekPosition = Math.floor(daysDiff / 7);
                      
                      if (weekPosition >= 0 && weekPosition < 53) {
                        monthPositions.push({
                          name: months[monthDate.getMonth()],
                          position: (weekPosition / 52) * 100
                        });
                      }
                    }
                  }
                  
                  return monthPositions.map((month, index) => (
                    <div 
                      key={month.name} 
                      className="absolute text-xs text-gray-500 whitespace-nowrap"
                      style={{
                        left: `${month.position}%`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      {month.name}
                    </div>
                  ));
                })()}
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-600">
              <span>{legendLess}</span>
              <div className="flex gap-1">
                {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map((color, index) => (
                  <div
                    key={index}
                    className="w-3 h-3 rounded-sm border border-gray-300"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span>{legendMore}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50/50 border border-orange-400 rounded-lg p-4 flex flex-col items-center justify-center text-center" style={{ minHeight: '120px' }}>
            <div className="text-2xl font-bold text-blue-600">{commits.length}</div>
            <div className="text-blue-500 text-sm">{statsTotal}</div>
          </div>
          <div className="bg-green-50/50 border border-orange-400 rounded-lg p-4 flex flex-col items-center justify-center text-center" style={{ minHeight: '120px' }}>
            <div className="text-xl font-bold text-green-600 mb-1">
              {commits.length > 0 ? (
                <>
                  <div className="text-lg">
                    {new Date(commits[0].timestamp.split(', ')[0].split('.').reverse().join('-')).toLocaleDateString(i18n.language)}
                  </div>
                  <div className="text-sm font-normal text-green-500">
                    {commits[0].timestamp.split(', ')[1]}
                  </div>
                </>
              ) : '—'}
            </div>
            <div className="text-green-500 text-sm">{statsLast}</div>
          </div>
          <div className="bg-purple-50/50 border border-orange-400 rounded-lg p-4 flex flex-col items-center justify-center text-center" style={{ minHeight: '120px' }}>
            <div className="text-2xl font-bold text-purple-600">{activityData.filter(d => d.count > 0).length}</div>
            <div className="text-purple-500 text-sm">{statsDays}</div>
          </div>
        </div>

        {/* Commit List */}
        {commits.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">{noCommitsTitle}</h2>
            <p className="text-yellow-600">{noCommitsMessage}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {commits.map((commit, index) => (
              <div key={index} className="bg-[#faf5eb] border border-orange-300 rounded-lg p-4 hover:shadow-md transition-shadow w-full max-w-full overflow-hidden flex flex-col justify-center" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)', minHeight: '120px' }}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                        {commit.hash.substring(0, 7)}
                      </span>
                      <span className="text-sm text-gray-500 truncate">{commit.author}</span>
                    </div>
                    <h3 className="font-medium text-gray-900 break-words">{commit.message}</h3>
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap flex-shrink-0">
                    {commit.timestamp}
                  </span>
                </div>
                <div className="mt-1">
                  <a 
                    href={commit.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                  >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l-1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                  View on GitHub
                </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
