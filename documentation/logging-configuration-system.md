# Logging Configuration System

## Overview

This system provides granular control over logging across different modules and layers of the application. Administrators can configure logging levels and enable/disable specific components through an intuitive admin interface.

## Features

### Granular Control
- **Global Settings**: Enable/disable all logging and set global log level
- **Module-Specific Configuration**: Control logging for individual system components
- **Multiple Log Levels**: None, Error, Warning, Info, Debug
- **Real-time Updates**: Configuration changes take effect immediately

### Admin Interface
- **Web-based Configuration**: Accessible through admin dashboard
- **Presets**: Quick configuration templates for common scenarios
- **Import/Export**: Save and restore configurations
- **Visual Status**: Clear indicators of current logging state

### Module Coverage
The system covers these key areas:
- **API Layer**: REST API requests and responses
- **WebSocket**: Real-time connection and messaging
- **Authentication**: Login, logout, token management
- **Database**: Queries and connections
- **UI Components**: Rendering and interactions
- **Reading Progress**: Book tracking and progress updates
- **Books Management**: Book operations and metadata
- **Shelves**: Bookshelf creation and management
- **Comments & Reviews**: User-generated content
- **Reactions**: Emoji reactions and voting
- **File Handling**: Uploads and downloads
- **Performance**: Timing and metrics
- **Error Tracking**: Application errors and exceptions
- **User Actions**: Activity and behavior tracking

## Usage

### Accessing Configuration
1. Navigate to Admin Dashboard
2. Click on "Logging Configuration" in the sidebar
3. Configure global settings and individual modules

### Configuration Options
- **Global Enabled**: Toggle all logging on/off
- **Global Level**: Set base verbosity level
- **Module Settings**: Enable/disable individual modules and set their log levels

### Presets
- **Minimal**: Only critical errors logged
- **Standard**: Errors and warnings
- **Development**: Detailed info-level logging

## Technical Implementation

### Client-Side
- **Centralized Logger**: Singleton factory pattern
- **Module Registration**: Automatic logger creation for components
- **Configuration Sync**: Real-time updates across all loggers
- **Persistence**: Server-side storage with localStorage fallback

### Server-Side
- **REST API**: CRUD operations for logging configuration
- **Validation**: Structure and type checking
- **Access Control**: Admin-only endpoints
- **Persistence**: In-memory storage (can be extended to database)

## API Endpoints

### GET /api/admin/logging-config
Retrieve current logging configuration

### PUT /api/admin/logging-config
Update logging configuration

### POST /api/admin/logging-config/reset
Reset to default configuration

### GET /api/admin/logging-config/export
Export current configuration

## Example Configuration

```json
{
  "globalEnabled": true,
  "globalLevel": "info",
  "modules": {
    "api": { "enabled": true, "level": "warn" },
    "websocket": { "enabled": false, "level": "none" },
    "auth": { "enabled": true, "level": "info" },
    "database": { "enabled": true, "level": "error" },
    "ui": { "enabled": false, "level": "none" },
    "readingProgress": { "enabled": true, "level": "debug" },
    "books": { "enabled": true, "level": "info" },
    "shelves": { "enabled": true, "level": "info" },
    "comments": { "enabled": true, "level": "info" },
    "reactions": { "enabled": true, "level": "info" },
    "fileHandling": { "enabled": true, "level": "warn" },
    "performance": { "enabled": false, "level": "none" },
    "errors": { "enabled": true, "level": "error" },
    "userActions": { "enabled": true, "level": "info" }
  }
}
```

## Best Practices

### Production
- Enable only essential modules
- Use "error" or "warn" levels
- Monitor performance impact

### Development
- Enable relevant modules for debugging
- Use "info" or "debug" levels as needed
- Regular configuration cleanup

### Troubleshooting
- Start with minimal preset
- Gradually enable modules
- Use export/import for backup

## Future Enhancements

- Database persistence for configurations
- User-specific logging profiles
- Advanced filtering options
- Log aggregation and analysis
- Automated log rotation
- Integration with external monitoring tools