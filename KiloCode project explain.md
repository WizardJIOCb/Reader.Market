# Ollama-Reader Project Explanation

## Project Overview

**Ollama-Reader** is a full-stack web application designed for reading and managing electronic books (ebooks) with integrated artificial intelligence features. The application combines traditional ebook reading capabilities with AI-powered analysis tools to enhance the reading experience, making it particularly useful for educational, research, and analytical purposes.

## Purpose and Goals

The primary purpose of Ollama-Reader is to create an enhanced ebook reading platform that goes beyond basic text display by incorporating AI assistance for:

- **Intelligent Content Analysis**: Using local AI models to analyze selected text, provide summaries, and explain complex terms
- **Enhanced Learning**: Helping users better understand and retain information through AI-generated insights
- **Personal Library Management**: Organizing books into custom shelves with bookmarking and progress tracking
- **Community Features**: Allowing users to share reviews, comments, and ratings on books
- **Multi-format Support**: Supporting various ebook formats for broad compatibility

## Key Mechanisms and Features

### Core Reading Features
- **Multi-format Ebook Support**: Supports EPUB, MOBI, AZW3, FB2, CBZ, and experimental PDF formats
- **Advanced Reader Interface**: Professional-grade ebook rendering using Foliate.js with customizable fonts, themes, and layouts
- **Bookmark Management**: Save and navigate to specific reading positions
- **Reading Progress Tracking**: Monitor reading statistics and progress across books

### AI Integration
- **Text Selection Analysis**: Select any text to get AI-powered explanations and summaries
- **Chapter Summaries**: Automatic generation of intelligent chapter summaries using Ollama AI
- **Term Explanation**: Contextual explanations of selected terms and concepts
- **Content Analysis**: AI-driven key point extraction and content insights

### Library Management
- **Personal Bookshelves**: Create custom shelves to organize books by categories, genres, or reading status
- **Book Search and Discovery**: Powerful search functionality to find books in your library
- **Book Metadata Management**: Add, edit, and manage book information including titles, authors, genres
- **Reading Statistics**: Track reading habits, time spent, and progress metrics

### Social Features
- **User Reviews and Ratings**: Rate books and write detailed reviews
- **Comments System**: Discuss books with other users through comments
- **User Profiles**: Personal profiles with reading history and preferences

### User Management
- **Authentication System**: Secure user registration and login with JWT tokens
- **Session Management**: Persistent sessions with secure cookie-based authentication
- **User Roles**: Basic user role system for access control

## Technology Stack

### Frontend
- **React 19**: Modern React framework for building the user interface
- **TypeScript**: Type-safe JavaScript for better code quality and developer experience
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React Query (TanStack Query)**: Powerful data fetching and state management library
- **React Router (Wouter)**: Client-side routing for single-page application navigation
- **Radix UI**: Accessible component library for consistent UI elements
- **Framer Motion**: Animation library for smooth transitions and interactions

### Backend
- **Node.js**: JavaScript runtime for server-side development
- **Express.js**: Web framework for building RESTful APIs
- **TypeScript**: Type-safe backend development
- **PostgreSQL**: Robust relational database for data persistence
- **Drizzle ORM**: Type-safe SQL query builder and database toolkit
- **JWT (jsonwebtoken)**: Secure token-based authentication
- **bcrypt**: Password hashing for security
- **Multer**: File upload handling for book files
- **WebSocket (ws)**: Real-time communication capabilities

### AI and External Services
- **Ollama**: Local AI model runner for text analysis and generation
- **Foliate.js**: Professional ebook rendering engine
- **EPUB.js**: Additional ebook format support

### Development and Build Tools
- **tsx**: TypeScript execution and REPL
- **ESBuild**: Fast JavaScript bundler
- **Vite Plugins**: Development enhancements for Replit environment
- **Drizzle Kit**: Database migration and schema management tool
- **Docker**: Containerization for database setup

### Testing and Quality
- **Jest**: Testing framework for unit tests
- **React Testing Library**: Testing utilities for React components

## Local Development Setup

### Prerequisites
- **Node.js** (version 16 or higher)
- **Docker** (for running PostgreSQL database)
- **Git** (for version control)
- **Ollama** (for AI features - must be running locally)

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd "Ollama-Reader - KiloCode"
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up PostgreSQL Database**
   Start a PostgreSQL container using Docker:
   ```bash
   docker run -d --name postgres-db \
     -e POSTGRES_PASSWORD=bookspassword \
     -e POSTGRES_USER=booksuser \
     -e POSTGRES_DB=booksdb \
     -p 5432:5432 \
     postgres:16
   ```

4. **Environment Configuration**
   The project includes a pre-configured `.env` file with:
   ```
   DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
   PORT=5001
   JWT_SECRET=my_secret_key_for_jwt_tokens
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_MODEL=llama2
   ```

5. **Run Database Migrations**
   ```bash
   npm run db:push
   ```

6. **Start Ollama (for AI features)**
   Ensure Ollama is installed and running on port 11434:
   ```bash
   ollama serve
   ```

7. **Start Development Servers**

   **Backend Server** (Express):
   ```bash
   npm run dev
   ```
   Runs on `http://localhost:5001`

   **Frontend Server** (React/Vite):
   ```bash
   npm run dev:client
   ```
   Runs on `http://localhost:3001`

8. **Access the Application**
   - Open `http://localhost:3001` in your browser for the main application
   - Backend API is available at `http://localhost:5001/api`

### Available NPM Scripts
- `npm run dev` - Start backend development server
- `npm run dev:client` - Start frontend development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Apply database schema changes
- `npm run check` - Run TypeScript type checking

### Production Deployment
1. Build the application: `npm run build`
2. Start the production server: `npm run start`
3. The application will be available on the configured port (default: 5001)

### Troubleshooting
- **Database Issues**: Ensure Docker container is running and credentials match
- **Port Conflicts**: Check if ports 3001, 5001, 5432 are available
- **AI Features**: Verify Ollama is running and accessible
- **Windows Issues**: The project uses `cross-env` for cross-platform compatibility

## Project Structure
```
Ollama-Reader - KiloCode/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions and configurations
├── server/                 # Express backend application
├── migrations/            # Database migration files
├── scripts/               # Build and utility scripts
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
└── drizzle.config.ts      # Database configuration
```

This project represents a comprehensive ebook reading platform that leverages modern web technologies and AI to provide an enhanced reading experience.