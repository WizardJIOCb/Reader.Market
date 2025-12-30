# Ollama-Reader

A sophisticated ebook reader application that combines modern web technologies with AI-powered analysis capabilities. The application allows users to upload, read, organize, and analyze ebooks with the help of Ollama AI integration.

## Table of Contents

1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Usage](#usage)
8. [Development](#development)
9. [API Documentation](#api-documentation)
10. [Database Schema](#database-schema)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)
13. [Contributing](#contributing)
14. [License](#license)

## Features

- **Multi-format Ebook Support**: Read EPUB, MOBI, AZW3, FB2, CBZ, and experimental PDF formats
- **AI-Powered Analysis**: Intelligent content summarization, key point extraction, and term explanation using Ollama
- **Personal Bookshelves**: Organize books into custom collections with color coding
- **Advanced Reading Experience**: 
  - Professional-grade ebook rendering with Foliate.js
  - Adjustable font size, line spacing, and themes
  - Paginated and scrolled view modes
  - Progress tracking and bookmark management
- **Social Features**: Book reviews, comments, and reactions
- **Reading Statistics**: Track reading time, words read, and books completed
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

### Backend
- **Node.js** - JavaScript runtime environment
- **Express** - Web application framework
- **PostgreSQL** - Relational database management system
- **Drizzle ORM** - TypeScript ORM for database operations
- **Ollama** - Local AI model runner
- **TypeScript** - Typed superset of JavaScript

### Frontend
- **React 19** - User interface library
- **Foliate.js** - Professional ebook rendering engine
- **Tailwind CSS** - Utility-first CSS framework
- **TanStack Query** - Server state management
- **Lucide React** - Icon library
- **Radix UI** - Accessible UI components
- **Wouter** - React router

### Development & Deployment
- **Vite** - Fast build tool
- **Docker** - Containerization platform
- **PM2** - Production process manager
- **Nginx** - Web server and reverse proxy
- **Let's Encrypt** - SSL certificate management

## Architecture

The application follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                       │
├─────────────────────────────────────────────────────────┤
│  React Components  │  UI Components  │  State Management │
│  (BookReader,      │  (Radix UI,    │  (TanStack Query) │
│   Library, etc.)   │   Tailwind)    │                   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                         │
├─────────────────────────────────────────────────────────┤
│  Reader Service   │  AI Analysis      │  API Client     │
│  (Foliate.js      │  Adapter          │  (Axios)        │
│   integration)    │  (Ollama)         │                 │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend Layer                        │
├─────────────────────────────────────────────────────────┤
│  Express Server   │  Authentication   │  Middleware     │
│  (API Routes)     │  (Passport)       │  (CORS, etc.)   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                            │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL DB    │  Drizzle ORM       │  Migrations    │
└─────────────────────────────────────────────────────────┘
```

### Key Components

1. **EnhancedBookReader**: The main ebook reader component using Foliate.js for rendering
2. **ReaderService**: Abstraction layer between React components and Foliate.js
3. **AIAnalysisAdapter**: Integration layer for Ollama AI features
4. **Authentication System**: Complete user registration and login system
5. **Book Management**: Upload, storage, and retrieval of ebook files

## Project Structure

```
Ollama-Reader/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ebook-reader/  # Ebook reader specific components
│   │   │   ├── ui/           # Radix UI components
│   │   │   └── ...           # Other components
│   │   ├── pages/            # Route components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utility functions and services
│   │   └── App.tsx           # Main application component
│   ├── index.html
│   └── tsconfig.json
├── server/                    # Backend Express server
│   ├── index.ts              # Main server entry point
│   ├── routes.ts             # API route definitions
│   ├── static.ts             # Static file serving
│   ├── storage.ts            # File storage logic
│   └── vite.ts               # Vite integration
├── shared/                    # Shared code between frontend and backend
│   ├── schema.ts             # Database schema definitions
│   └── ...                   # Shared types and utilities
├── migrations/               # Database migration files
├── uploads/                  # User uploaded ebook files
├── screenshots/              # Project screenshots
├── script/                   # Build scripts
├── .env                      # Environment variables
├── .gitignore
├── package.json
├── DATABASE_SETUP.md         # Database setup instructions
├── DEPLOYMENT_INSTRUCTIONS.md # Production deployment guide
├── LOCAL_SETUP.md            # Local development setup
├── INTEGRATION_SUMMARY.md    # Integration documentation
└── ...
```

## Installation

### Prerequisites

- Node.js (version 16 or higher)
- Docker (for PostgreSQL database)
- Git
- Ollama (for AI features)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Ollama-Reader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   ```bash
   # Start PostgreSQL container
   docker run -d --name postgres-db \
     -e POSTGRES_PASSWORD=bookspassword \
     -e POSTGRES_USER=booksuser \
     -e POSTGRES_DB=booksdb \
     -p 5432:5432 \
     postgres:16
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the project root:
   ```
   DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
   PORT=3000
   ```

5. **Run database migrations**
   ```bash
   npm run db:push
   ```

6. **Start the development servers**
   
   In separate terminals:
   ```bash
   # Backend server
   npm run dev
   ```
   
   ```bash
   # Frontend development server
   npm run dev:client
   ```

7. **Access the application**
   - Frontend: `http://localhost:5000`
   - Backend API: `http://localhost:3000/api`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL database connection string | - |
| `PORT` | Backend server port | 3000 |
| `OLLAMA_HOST` | Ollama API host | http://localhost:11434 |

### Database Configuration

The application uses PostgreSQL with the following tables:
- `users` - User account information
- `books` - Ebook metadata and file information
- `shelves` - User-created bookshelves
- `shelf_books` - Junction table for shelves and books
- `reading_progress` - Track reading progress for books
- `reading_statistics` - Detailed reading statistics per book
- `user_statistics` - Overall user reading statistics
- `bookmarks` - User-created bookmarks
- `comments` - Book comments
- `reviews` - Book reviews and ratings
- `reactions` - Likes and reactions to comments/reviews

## Usage

### User Registration and Login

1. Navigate to `/register` to create an account
2. Use `/login` to sign in with your credentials
3. Your session will be maintained with JWT tokens

### Adding Books

1. Go to `/add-book` to upload new ebooks
2. Supported formats: EPUB, MOBI, AZW3, FB2, CBZ (PDF experimental)
3. Books will appear in your library after upload

### Reading Books

1. Access your library at `/` or browse books
2. Click on a book to view details at `/book/:bookId`
3. Use `/read/:bookId/:chapterId` to open the ebook reader
4. Adjust reading settings using the controls in the reader
5. Create bookmarks and access AI analysis features

### Managing Shelves

1. Visit `/shelves` to view your book collections
2. Create new shelves to organize your books
3. Add books to shelves for better organization

### AI Features

The application integrates with Ollama AI models to provide:

- **Content Summarization**: Get AI-generated summaries of chapters or sections
- **Key Point Extraction**: Identify important concepts and ideas
- **Term Explanation**: Understand complex terms in context
- **Smart Chapter Summaries**: AI-powered chapter overviews

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the backend development server |
| `npm run dev:client` | Start the frontend development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run db:push` | Push database schema changes |
| `npm run check` | Type-check the codebase |

### Development Workflow

1. Make changes to the codebase
2. The frontend will automatically reload in development mode
3. For backend changes, restart the development server
4. Write tests for new features
5. Run type checks before committing: `npm run check`

### Code Structure

- **Frontend**: React components following modern best practices
- **Backend**: Express API with clean separation of routes and business logic
- **Database**: Drizzle ORM with TypeScript schemas
- **Shared**: Types and utilities used by both frontend and backend

## API Documentation

The application provides a RESTful API for managing books, users, and reading features.

### Authentication

Most endpoints require authentication using JWT tokens:

```
Authorization: Bearer <token>
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

#### Books
- `GET /api/books` - Get all books
- `GET /api/books/:id` - Get book by ID
- `POST /api/books` - Upload new book
- `DELETE /api/books/:id` - Delete book

#### Shelves
- `GET /api/shelves` - Get user shelves
- `POST /api/shelves` - Create new shelf
- `PUT /api/shelves/:id` - Update shelf
- `DELETE /api/shelves/:id` - Delete shelf

#### Reading Progress
- `GET /api/progress/:bookId` - Get reading progress
- `POST /api/progress/:bookId` - Update reading progress
- `GET /api/bookmarks/:bookId` - Get bookmarks for a book

#### Reviews & Comments
- `GET /api/books/:bookId/reviews` - Get book reviews
- `POST /api/books/:bookId/reviews` - Add book review
- `GET /api/books/:bookId/comments` - Get book comments
- `POST /api/books/:bookId/comments` - Add book comment

## Database Schema

The application uses PostgreSQL with the following schema:

### Users Table
Stores user account information with authentication details.

### Books Table
Manages ebook metadata including title, author, file path, and user associations.

### Shelves Table
Contains user-created book collections for organizing books.

### Reading Tables
- `reading_progress` - Tracks current reading position for each user-book combination
- `reading_statistics` - Detailed statistics about reading activity
- `user_statistics` - Overall reading statistics per user

### Social Tables
- `bookmarks` - User-created bookmarks
- `comments` - Book comments
- `reviews` - Book reviews with ratings
- `reactions` - Likes and reactions to content

## Deployment

### Production Setup

For production deployment, refer to the `DEPLOYMENT_INSTRUCTIONS.md` file which includes:

- Server preparation and security configuration
- Automated deployment script usage
- SSL certificate setup with Let's Encrypt
- PM2 process management
- Nginx reverse proxy configuration
- Database backup and recovery procedures

### Environment Considerations

- Ensure sufficient server resources for ebook storage and processing
- Configure Ollama models for production use
- Set up proper SSL certificates for secure communication
- Configure backup strategies for database and uploaded files

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   - Check if ports 3000 (backend) and 5000 (frontend) are available
   - Modify ports in `.env` and configuration files if needed

2. **Database Connection Issues**
   - Verify PostgreSQL container is running: `docker ps`
   - Check credentials in `.env` match Docker container settings
   - Ensure port 5432 is not blocked by firewall

3. **Ollama Integration Issues**
   - Verify Ollama is running: `curl http://localhost:11434`
   - Check that required models are pulled: `ollama pull <model-name>`

4. **File Upload Issues**
   - Ensure upload directory has proper write permissions
   - Check file size limits in configuration

### Development Troubleshooting

- On Windows, ensure `cross-env` is properly handling environment variables
- If experiencing issues with Foliate.js, verify it's properly installed and accessible
- Check browser console for client-side errors
- Monitor server logs for backend issues

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Commit your changes: `git commit -m 'Add some feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

### Code Standards

- Follow TypeScript best practices
- Write clear, descriptive commit messages
- Include tests for new functionality
- Update documentation as needed
- Follow existing code style and patterns

## License

This project is licensed under the MIT License - see the LICENSE file for details.# Ollama-Reader

A sophisticated ebook reader application that combines modern web technologies with AI-powered analysis capabilities. The application allows users to upload, read, organize, and analyze ebooks with the help of Ollama AI integration.

## Table of Contents

1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Usage](#usage)
8. [Development](#development)
9. [API Documentation](#api-documentation)
10. [Database Schema](#database-schema)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)
13. [Contributing](#contributing)
14. [License](#license)

## Features

- **Multi-format Ebook Support**: Read EPUB, MOBI, AZW3, FB2, CBZ, and experimental PDF formats
- **AI-Powered Analysis**: Intelligent content summarization, key point extraction, and term explanation using Ollama
- **Personal Bookshelves**: Organize books into custom collections with color coding
- **Advanced Reading Experience**: 
  - Professional-grade ebook rendering with Foliate.js
  - Adjustable font size, line spacing, and themes
  - Paginated and scrolled view modes
  - Progress tracking and bookmark management
- **Social Features**: Book reviews, comments, and reactions
- **Reading Statistics**: Track reading time, words read, and books completed
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

### Backend
- **Node.js** - JavaScript runtime environment
- **Express** - Web application framework
- **PostgreSQL** - Relational database management system
- **Drizzle ORM** - TypeScript ORM for database operations
- **Ollama** - Local AI model runner
- **TypeScript** - Typed superset of JavaScript

### Frontend
- **React 19** - User interface library
- **Foliate.js** - Professional ebook rendering engine
- **Tailwind CSS** - Utility-first CSS framework
- **TanStack Query** - Server state management
- **Lucide React** - Icon library
- **Radix UI** - Accessible UI components
- **Wouter** - React router

### Development & Deployment
- **Vite** - Fast build tool
- **Docker** - Containerization platform
- **PM2** - Production process manager
- **Nginx** - Web server and reverse proxy
- **Let's Encrypt** - SSL certificate management

## Architecture

The application follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                       │
├─────────────────────────────────────────────────────────┤
│  React Components  │  UI Components  │  State Management │
│  (BookReader,      │  (Radix UI,    │  (TanStack Query) │
│   Library, etc.)   │   Tailwind)    │                   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                         │
├─────────────────────────────────────────────────────────┤
│  Reader Service   │  AI Analysis      │  API Client     │
│  (Foliate.js      │  Adapter          │  (Axios)        │
│   integration)    │  (Ollama)         │                 │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend Layer                        │
├─────────────────────────────────────────────────────────┤
│  Express Server   │  Authentication   │  Middleware     │
│  (API Routes)     │  (Passport)       │  (CORS, etc.)   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                            │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL DB    │  Drizzle ORM       │  Migrations    │
└─────────────────────────────────────────────────────────┘
```

### Key Components

1. **EnhancedBookReader**: The main ebook reader component using Foliate.js for rendering
2. **ReaderService**: Abstraction layer between React components and Foliate.js
3. **AIAnalysisAdapter**: Integration layer for Ollama AI features
4. **Authentication System**: Complete user registration and login system
5. **Book Management**: Upload, storage, and retrieval of ebook files

## Project Structure

```
Ollama-Reader/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ebook-reader/  # Ebook reader specific components
│   │   │   ├── ui/           # Radix UI components
│   │   │   └── ...           # Other components
│   │   ├── pages/            # Route components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utility functions and services
│   │   └── App.tsx           # Main application component
│   ├── index.html
│   └── tsconfig.json
├── server/                    # Backend Express server
│   ├── index.ts              # Main server entry point
│   ├── routes.ts             # API route definitions
│   ├── static.ts             # Static file serving
│   ├── storage.ts            # File storage logic
│   └── vite.ts               # Vite integration
├── shared/                    # Shared code between frontend and backend
│   ├── schema.ts             # Database schema definitions
│   └── ...                   # Shared types and utilities
├── migrations/               # Database migration files
├── uploads/                  # User uploaded ebook files
├── screenshots/              # Project screenshots
├── script/                   # Build scripts
├── .env                      # Environment variables
├── .gitignore
├── package.json
├── DATABASE_SETUP.md         # Database setup instructions
├── DEPLOYMENT_INSTRUCTIONS.md # Production deployment guide
├── LOCAL_SETUP.md            # Local development setup
├── INTEGRATION_SUMMARY.md    # Integration documentation
└── ...
```

## Installation

### Prerequisites

- Node.js (version 16 or higher)
- Docker (for PostgreSQL database)
- Git
- Ollama (for AI features)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Ollama-Reader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   ```bash
   # Start PostgreSQL container
   docker run -d --name postgres-db \
     -e POSTGRES_PASSWORD=bookspassword \
     -e POSTGRES_USER=booksuser \
     -e POSTGRES_DB=booksdb \
     -p 5432:5432 \
     postgres:16
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the project root:
   ```
   DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
   PORT=3000
   ```

5. **Run database migrations**
   ```bash
   npm run db:push
   ```

6. **Start the development servers**
   
   In separate terminals:
   ```bash
   # Backend server
   npm run dev
   ```
   
   ```bash
   # Frontend development server
   npm run dev:client
   ```

7. **Access the application**
   - Frontend: `http://localhost:5000`
   - Backend API: `http://localhost:3000/api`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL database connection string | - |
| `PORT` | Backend server port | 3000 |
| `OLLAMA_HOST` | Ollama API host | http://localhost:11434 |

### Database Configuration

The application uses PostgreSQL with the following tables:
- `users` - User account information
- `books` - Ebook metadata and file information
- `shelves` - User-created bookshelves
- `shelf_books` - Junction table for shelves and books
- `reading_progress` - Track reading progress for books
- `reading_statistics` - Detailed reading statistics per book
- `user_statistics` - Overall user reading statistics
- `bookmarks` - User-created bookmarks
- `comments` - Book comments
- `reviews` - Book reviews and ratings
- `reactions` - Likes and reactions to comments/reviews

## Usage

### User Registration and Login

1. Navigate to `/register` to create an account
2. Use `/login` to sign in with your credentials
3. Your session will be maintained with JWT tokens

### Adding Books

1. Go to `/add-book` to upload new ebooks
2. Supported formats: EPUB, MOBI, AZW3, FB2, CBZ (PDF experimental)
3. Books will appear in your library after upload

### Reading Books

1. Access your library at `/` or browse books
2. Click on a book to view details at `/book/:bookId`
3. Use `/read/:bookId/:chapterId` to open the ebook reader
4. Adjust reading settings using the controls in the reader
5. Create bookmarks and access AI analysis features

### Managing Shelves

1. Visit `/shelves` to view your book collections
2. Create new shelves to organize your books
3. Add books to shelves for better organization

### AI Features

The application integrates with Ollama AI models to provide:

- **Content Summarization**: Get AI-generated summaries of chapters or sections
- **Key Point Extraction**: Identify important concepts and ideas
- **Term Explanation**: Understand complex terms in context
- **Smart Chapter Summaries**: AI-powered chapter overviews

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the backend development server |
| `npm run dev:client` | Start the frontend development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run db:push` | Push database schema changes |
| `npm run check` | Type-check the codebase |

### Development Workflow

1. Make changes to the codebase
2. The frontend will automatically reload in development mode
3. For backend changes, restart the development server
4. Write tests for new features
5. Run type checks before committing: `npm run check`

### Code Structure

- **Frontend**: React components following modern best practices
- **Backend**: Express API with clean separation of routes and business logic
- **Database**: Drizzle ORM with TypeScript schemas
- **Shared**: Types and utilities used by both frontend and backend

## API Documentation

The application provides a RESTful API for managing books, users, and reading features.

### Authentication

Most endpoints require authentication using JWT tokens:

```
Authorization: Bearer <token>
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

#### Books
- `GET /api/books` - Get all books
- `GET /api/books/:id` - Get book by ID
- `POST /api/books` - Upload new book
- `DELETE /api/books/:id` - Delete book

#### Shelves
- `GET /api/shelves` - Get user shelves
- `POST /api/shelves` - Create new shelf
- `PUT /api/shelves/:id` - Update shelf
- `DELETE /api/shelves/:id` - Delete shelf

#### Reading Progress
- `GET /api/progress/:bookId` - Get reading progress
- `POST /api/progress/:bookId` - Update reading progress
- `GET /api/bookmarks/:bookId` - Get bookmarks for a book

#### Reviews & Comments
- `GET /api/books/:bookId/reviews` - Get book reviews
- `POST /api/books/:bookId/reviews` - Add book review
- `GET /api/books/:bookId/comments` - Get book comments
- `POST /api/books/:bookId/comments` - Add book comment

## Database Schema

The application uses PostgreSQL with the following schema:

### Users Table
Stores user account information with authentication details.

### Books Table
Manages ebook metadata including title, author, file path, and user associations.

### Shelves Table
Contains user-created book collections for organizing books.

### Reading Tables
- `reading_progress` - Tracks current reading position for each user-book combination
- `reading_statistics` - Detailed statistics about reading activity
- `user_statistics` - Overall reading statistics per user

### Social Tables
- `bookmarks` - User-created bookmarks
- `comments` - Book comments
- `reviews` - Book reviews with ratings
- `reactions` - Likes and reactions to content

## Deployment

### Production Setup

For production deployment, refer to the `DEPLOYMENT_INSTRUCTIONS.md` file which includes:

- Server preparation and security configuration
- Automated deployment script usage
- SSL certificate setup with Let's Encrypt
- PM2 process management
- Nginx reverse proxy configuration
- Database backup and recovery procedures

### Environment Considerations

- Ensure sufficient server resources for ebook storage and processing
- Configure Ollama models for production use
- Set up proper SSL certificates for secure communication
- Configure backup strategies for database and uploaded files

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   - Check if ports 3000 (backend) and 5000 (frontend) are available
   - Modify ports in `.env` and configuration files if needed

2. **Database Connection Issues**
   - Verify PostgreSQL container is running: `docker ps`
   - Check credentials in `.env` match Docker container settings
   - Ensure port 5432 is not blocked by firewall

3. **Ollama Integration Issues**
   - Verify Ollama is running: `curl http://localhost:11434`
   - Check that required models are pulled: `ollama pull <model-name>`

4. **File Upload Issues**
   - Ensure upload directory has proper write permissions
   - Check file size limits in configuration

### Development Troubleshooting

- On Windows, ensure `cross-env` is properly handling environment variables
- If experiencing issues with Foliate.js, verify it's properly installed and accessible
- Check browser console for client-side errors
- Monitor server logs for backend issues

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Commit your changes: `git commit -m 'Add some feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

### Code Standards

- Follow TypeScript best practices
- Write clear, descriptive commit messages
- Include tests for new functionality
- Update documentation as needed
- Follow existing code style and patterns

## License

This project is licensed under the MIT License - see the LICENSE file for details.