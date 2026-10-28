# Ollama-Reader Local Setup Guide

This document provides instructions for setting up and running the Ollama-Reader project locally.

## Prerequisites

- Node.js (version 16 or higher)
- Docker (for running PostgreSQL)
- Git

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Ollama-Reader
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up PostgreSQL Database

The project uses PostgreSQL as its database. You can run it using Docker:

```bash
# Start PostgreSQL container
docker run -d --name postgres-db \
  -e POSTGRES_PASSWORD=bookspassword \
  -e POSTGRES_USER=booksuser \
  -e POSTGRES_DB=booksdb \
  -p 5432:5432 \
  postgres:16
```

For detailed database setup instructions, including how to connect with DBeaver, see [DATABASE_SETUP.md](./DATABASE_SETUP.md).

### 4. Configure Environment Variables

Create a `.env` file in the project root with the following content:

```env
DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
PORT=3000
```

### 5. Run Database Migrations

```bash
npm run db:push
```

### 6. Start the Development Servers

The project consists of two separate servers:

#### Backend Server
```bash
npm run dev
```
This starts the backend server on port 3000.

#### Frontend Development Server
```bash
npm run dev:client
```
This starts the frontend development server on port 5000.

### 7. Access the Application

Once both servers are running:
- Visit `http://localhost:5000` to access the frontend
- The backend API is available at `http://localhost:3000/api`

## Project Structure

- `client/` - Frontend React application
- `server/` - Backend Express server
- `shared/` - Shared code between frontend and backend
- `script/` - Build scripts

## Available Scripts

- `npm run dev` - Start the backend development server
- `npm run dev:client` - Start the frontend development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run db:push` - Push database schema changes
- `npm run check` - Type-check the codebase

## Features

- Book reading with smart chapter summaries using Ollama AI
- Personal bookshelves for organizing books
- Bookmark management
- Chapter navigation and review
- Search functionality for finding books

## Troubleshooting

### Port Conflicts

If you encounter port conflicts:
1. Change the PORT value in your `.env` file
2. Update the port in the `server/index.ts` file
3. Adjust the `dev:client` script in `package.json` if needed

### Database Connection Issues

If you have trouble connecting to the database:
1. Ensure the PostgreSQL container is running: `docker ps`
2. Check that the credentials in `.env` match the Docker container settings
3. Verify that port 5432 is not blocked by firewall

### Windows-Specific Issues

On Windows systems, some npm scripts might not work correctly due to environment variable differences. The project uses `cross-env` to handle this automatically.

## Building for Production

To create a production build:

```bash
npm run build
```

This will:
1. Build the frontend application
2. Bundle the backend server
3. Output everything to the `dist/` directory

To run the production build:

```bash
npm run start
```

## Additional Notes

- The application uses Drizzle ORM for database operations
- Tailwind CSS is used for styling
- React Query handles server state management
- Vite is used as the build tool for the frontend