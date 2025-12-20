# Database Setup and Connection Guide

This guide explains how to set up the PostgreSQL database for the Ollama-Reader application and connect to it using DBeaver.

## Prerequisites

- Docker (for running PostgreSQL)
- DBeaver (or any PostgreSQL client)
- Node.js and npm (for running database migrations)

## 1. Start PostgreSQL Database

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

This command creates a PostgreSQL container with:
- Database name: `booksdb`
- Username: `booksuser`
- Password: `bookspassword`
- Port: `5432` (standard PostgreSQL port)

## 2. Environment Configuration

The [.env](file:///C:/Projects/Ollama-Reader/.env) file already contains the database connection string:

```
DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
```

Ensure this file exists in the project root directory.

## 3. Run Database Migrations

After starting the PostgreSQL container, run the database migrations to create all necessary tables:

```bash
npm run db:push
```

This command will:
- Connect to the database using credentials from [.env](file:///C:/Projects/Ollama-Reader/.env)
- Create all tables defined in [shared/schema.ts](file:///c:/Projects/Ollama-Reader/shared/schema.ts)
- Set up proper relationships between tables

## 4. Verify Database Tables

After running migrations, the following tables will be created:
- `users` - User accounts
- `books` - Book information
- `shelves` - User-created bookshelves
- `shelf_books` - Junction table for shelves and books
- `reading_progress` - Track reading progress for books
- `reading_statistics` - Detailed reading statistics per book
- `user_statistics` - Overall user reading statistics
- `bookmarks` - User-created bookmarks

## 5. Connect with DBeaver

To connect to the database using DBeaver:

1. Open DBeaver
2. Click on "New Database Connection" (or press Ctrl+Alt+Shift+N)
3. Select "PostgreSQL" and click "Next"
4. Fill in the connection details:
   - Host: `localhost`
   - Port: `5432`
   - Database: `booksdb`
   - Username: `booksuser`
   - Password: `bookspassword`
5. Click "Test Connection" to verify the connection works
6. Click "Finish" to save the connection

## 6. Using the Authentication System

The authentication system is already implemented with the following endpoints:

### User Registration
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password",
  "email": "your_email@example.com",
  "fullName": "Your Full Name"
}
```

### User Login
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

Both endpoints return a JWT token that should be used for authenticated requests:
```
Authorization: Bearer <token>
```

## Troubleshooting

### Connection Issues
If you have trouble connecting to the database:
1. Ensure the PostgreSQL container is running: `docker ps`
2. Check that the credentials in [.env](file:///C:/Projects/Ollama-Reader/.env) match the Docker container settings
3. Verify that port 5432 is not blocked by firewall

### Resetting the Database
If you need to reset the database:
1. Stop the container: `docker stop postgres-db`
2. Remove the container: `docker rm postgres-db`
3. Start a new container using the command in step 1
4. Run migrations again: `npm run db:push`