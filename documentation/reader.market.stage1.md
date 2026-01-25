# Reader.Market - Stage 1 Documentation

## Project Overview

Reader.Market is a modern web-based platform for book enthusiasts featuring social reading, community discussions, and personal library management. Built with cutting-edge technologies, it provides a seamless experience for discovering, reading, and discussing books.

## Core Features

### 📚 Book Management
- **Book Upload & Storage**: Support for multiple formats (TXT, FB2, EPUB planned)
- **Reading Progress Tracking**: Real-time page-by-page progress with percentage completion
- **Personal Library**: User shelves for organizing books (Want to Read, Currently Reading, Finished)
- **Book Metadata**: Titles, authors, descriptions, ratings, genres, covers

### 💬 Social Features
- **Comments System**: Nested threaded discussions on books and reviews
- **Reviews & Ratings**: 1-10 star rating system with detailed reviews
- **Real-time Activity Feed**: Live updates of user actions (comments, reviews, ratings)
- **User Profiles**: Personal pages showing reading history, reviews, and statistics
- **Messaging System**: Private conversations between users
- **Group Chats**: Community channels for book discussions

### 🎯 Interactive Elements
- **Reactions System**: Emoji reactions on comments, reviews, and news
- **Bookmarking**: Save favorite passages and quotes
- **Search & Discovery**: Advanced book search with filters
- **News Section**: Platform announcements and literary news
- **Statistics Dashboard**: Reading analytics and personal metrics

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7.x for lightning-fast development
- **UI Components**: Custom component library with shadcn/ui foundation
- **Styling**: Tailwind CSS with custom themes
- **State Management**: React Context API + Custom Hooks
- **Routing**: React Router DOM
- **Internationalization**: react-i18next (Russian/English support)

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with OAuth 2.0 support
- **Real-time**: Socket.IO for live updates
- **File Storage**: Local file system with upload management
- **API Architecture**: RESTful endpoints with proper error handling

### Infrastructure
- **Deployment**: PM2 process manager
- **Web Server**: Nginx reverse proxy with SSL
- **Static Assets**: Served via Nginx from /dist/public
- **Environment**: Production-ready configuration

## Architecture Principles

### Performance Optimization
- **Caching Strategy**: In-memory caching for user data and reading progress
- **API Deduplication**: Prevent duplicate requests using request tracking
- **Batch Loading**: Aggregate multiple API calls into single requests
- **Lazy Loading**: Component and route-based code splitting
- **Image Optimization**: Automatic compression for uploaded images

### Data Consistency
- **Real-time Sync**: WebSocket connections for instant updates
- **Optimistic Updates**: Immediate UI feedback with background synchronization
- **Error Recovery**: Graceful degradation and retry mechanisms
- **Validation**: Comprehensive client and server-side validation

### User Experience
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Accessibility**: WCAG-compliant interfaces
- **Performance Monitoring**: Client-side logging and error tracking
- **Progressive Enhancement**: Core functionality works without JavaScript

## Key Systems

### Authentication & Authorization
```
OAuth 2.0 Flow → JWT Generation → Session Management → Role-based Access Control
```

### Reading Experience
```
Book Upload → Format Processing → Reader Engine → Progress Tracking → Statistics Collection
```

### Social Interaction
```
User Action → WebSocket Broadcast → Activity Feed Update → Notification System → UI Refresh
```

### Data Pipeline
```
Client Request → API Endpoint → Database Query → Cache Layer → Response Formatting → Client Update
```

## Current Development Status

### ✅ Completed Features
- Core book reading functionality with progress tracking
- Complete comments and reviews system with nesting
- Real-time activity feed with WebSocket integration
- User profiles with reading statistics
- Messaging system with private and group chats
- Book search and discovery features
- Administrative dashboard and moderation tools
- Multi-language support (RU/EN)

### 🔄 In Progress
- Enhanced mobile experience optimization
- Performance monitoring and analytics
- Advanced search algorithms
- Social sharing features

### 📋 Future Roadmap
- EPUB format support
- Audio book integration
- Recommendation engine
- Mobile applications (iOS/Android)
- Advanced analytics dashboard

## Deployment Information

### Production Environment
- **Domain**: reader.market
- **Server**: Dedicated hosting with Nginx + Node.js
- **Database**: PostgreSQL instance
- **Monitoring**: PM2 process management
- **SSL**: Let's Encrypt certificates

### Development Environment
- **Local Development**: Windows with PowerShell scripts
- **Hot Reloading**: Vite development server
- **Database**: Local PostgreSQL instance
- **Debugging**: Chrome DevTools integration

## Project Structure

```
reader.market/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   ├── pages/         # Page components
│   │   └── locales/       # Translation files
│   └── public/            # Static assets
├── server/                # Backend application
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   └── config/            # Configuration files
├── shared/                # Shared types and utilities
├── migrations/            # Database migrations
├── documentation/         # Project documentation
└── uploads/              # User uploaded files
```

## Contributing Guidelines

### Code Standards
- TypeScript for type safety
- ESLint and Prettier for code formatting
- Comprehensive testing strategy
- Git commit conventions

### Development Workflow
1. Branch from `main` for new features
2. Implement with proper error handling
3. Test locally with `start-dev.bat`
4. Verify build with `npm run build`
5. Create pull request with description

### Quality Assurance
- Pre-commit hooks for code validation
- Automated testing suite
- Manual QA checklist
- Performance benchmarking

## Support and Maintenance

### Monitoring
- Application performance tracking
- Error rate monitoring
- User engagement metrics
- System resource utilization

### Backup Strategy
- Daily database backups
- Configuration version control
- Asset backup procedures
- Disaster recovery plan

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Status: Stage 1 - Core Features Complete*