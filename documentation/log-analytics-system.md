# Log Analytics and Search System

## Overview

This system provides comprehensive log aggregation, search, and analytics capabilities for both frontend and backend logs. It's designed as a lightweight alternative to external tools like Kibana or Grafana, integrated directly into the admin panel.

## Features

### Log Collection
- **Frontend Logs**: Automatically captures console output (log, info, warn, error, debug)
- **Backend Logs**: HTTP request/response logging via middleware
- **Database Logs**: Query execution tracking with timing
- **WebSocket Logs**: Real-time connection and message events
- **Structured Data**: Captures metadata, user context, session information

### Search Capabilities
- **Multi-field Filtering**: Level, source, module, user ID, session ID
- **Time Range Search**: Filter by date/time ranges
- **Full-text Search**: Search within log messages and metadata
- **Pagination**: Efficient browsing of large log datasets
- **Real-time Updates**: Live log feed with polling

### Analytics & Visualization
- **Summary Statistics**: Total logs, error counts, averages
- **Distribution Charts**: Logs by level, source, and module
- **Trend Analysis**: Hourly/daily log volume patterns (planned)
- **Export Functionality**: JSON and CSV export options

### Admin Interface
- **Tabbed Navigation**: Search, Analytics, and Trends views
- **Interactive Filters**: Checkboxes, dropdowns, and search inputs
- **Visual Indicators**: Color-coded severity levels and source icons
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

### Backend Components

#### Log Aggregator (`server/logAggregator.ts`)
- Central log collection service
- In-memory storage with file persistence
- Event-driven architecture for real-time updates
- Search and filtering engine

#### Log Middleware (`server/logAggregator.ts`)
- Express middleware for HTTP request logging
- Automatic capture of request/response data
- Performance timing and error tracking

#### Analytics Routes (`server/routes/logAnalytics.ts`)
- REST API endpoints for log search and analytics
- Export functionality (JSON/CSV)
- Statistics and trend data endpoints

### Frontend Components

#### Frontend Logger (`client/src/lib/frontendLogger.ts`)
- Console interception for automatic log capture
- Session and user context tracking
- Direct API integration with backend aggregator

#### Log Analytics UI (`client/src/components/LogAnalytics.tsx`)
- Search interface with advanced filters
- Analytics dashboard with charts
- Export and management features

## API Endpoints

### Search Logs
```
POST /api/admin/logs/search
{
  "level": ["error", "warn"],
  "source": ["frontend", "backend"],
  "module": ["auth", "api"],
  "userId": "user123",
  "sessionId": "sess456",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "searchTerm": "database timeout",
  "limit": 50,
  "offset": 0
}
```

### Get Statistics
```
GET /api/admin/logs/stats
```

### Export Logs
```
POST /api/admin/logs/export
{
  "format": "json",
  "filters": { ... }
}
```

### Receive Frontend Logs
```
POST /api/admin/logs/frontend
{
  "level": "error",
  "source": "frontend",
  "module": "LoginForm",
  "message": "Authentication failed",
  "userId": "user123",
  "sessionId": "sess456",
  "metadata": { "errorCode": "AUTH_001" }
}
```

## Usage

### Accessing Log Analytics
1. Navigate to Admin Dashboard
2. Click on "Log Analytics" in the sidebar
3. Use tabs to switch between Search, Analytics, and Trends

### Searching Logs
1. Apply filters in the search panel
2. Use search term for full-text search
3. Browse results with pagination controls
4. Expand log entries to view metadata

### Analyzing Data
1. View summary statistics cards
2. Examine distribution charts
3. Identify patterns and anomalies
4. Export data for further analysis

## Configuration

### Storage Settings
```typescript
const MAX_LOGS = 10000; // Maximum logs to keep in memory
const LOG_FILE = 'logs/aggregated-logs.json'; // Persistence file
```

### Log Retention
```bash
# Clear logs older than 30 days
POST /api/admin/logs/clear-old
{
  "days": 30
}
```

## Future Enhancements

### Planned Features
- **Real-time WebSocket Streaming**: Live log updates without polling
- **Advanced Trend Analysis**: Statistical analysis and anomaly detection
- **Custom Dashboards**: User-defined analytics views
- **Alerting System**: Automated notifications for critical events
- **Log Rotation**: Automatic archiving of old logs
- **Integration with External Systems**: ELK stack, Prometheus, etc.

### Performance Improvements
- **Database Storage**: PostgreSQL backend for better scalability
- **Indexing**: Full-text search indexes for faster queries
- **Caching**: Redis caching for frequently accessed data
- **Compression**: Compressed log storage to reduce disk usage

## Security Considerations

### Access Control
- Admin-only endpoints with proper authentication
- Role-based access to different log sources
- Sensitive data filtering/redaction

### Data Privacy
- User ID anonymization options
- Session data retention policies
- GDPR compliance features

## Troubleshooting

### Common Issues

**No logs appearing:**
- Check if log middleware is properly registered
- Verify frontend logger initialization
- Confirm authentication token validity

**Performance issues:**
- Reduce MAX_LOGS setting
- Implement database storage
- Add query indexing

**Missing metadata:**
- Check log interceptor configuration
- Verify source-specific logging setup
- Review middleware integration

## Best Practices

### Log Structure
- Use consistent module naming
- Include relevant context in metadata
- Choose appropriate log levels
- Keep messages descriptive but concise

### Performance
- Avoid logging sensitive information
- Use debug level sparingly in production
- Implement log sampling for high-volume systems
- Monitor log storage growth

### Maintenance
- Regular log cleanup schedules
- Monitor system for logging errors
- Backup log archives regularly
- Review and update log formats periodically