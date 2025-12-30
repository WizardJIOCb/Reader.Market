# Project Deployment Design: Ollama-Reader on reader.market

## Overview

This document outlines the deployment strategy for the Ollama-Reader application on the reader.market domain. The deployment will involve setting up a production-ready environment on a server with IP address 82.146.42.213, utilizing the existing nginx configuration and ensuring all components of the application are properly configured for production use.

## Architecture Overview

The Ollama-Reader application is a full-stack application consisting of:

- **Frontend**: React application built with TypeScript and Vite
- **Backend**: Express.js server with PostgreSQL database integration
- **Database**: PostgreSQL for data persistence
- **AI Integration**: Ollama for AI-powered book analysis features
- **File Storage**: Uploads directory for book files and images
- **Reverse Proxy**: nginx for serving static assets and routing API requests

## Deployment Components

### 1. Server Infrastructure

- **Target Server**: 82.146.42.213
- **Domain**: reader.market
- **Web Server**: nginx (already configured)
- **Application Port**: To be configured (default: 3000)

### 2. Database Configuration

- **Database System**: PostgreSQL
- **Database Name**: booksdb
- **Database User**: booksuser
- **Connection**: Through Docker container or direct installation

### 3. Application Services

- **Backend Service**: Express.js server with production build
- **Frontend Build**: Vite-optimized static assets
- **Ollama Service**: AI model serving for book analysis

## Deployment Steps

### Step 1: Server Preparation

1. SSH into the target server (82.146.42.213)
2. Ensure necessary dependencies are installed:
   - Node.js (v16 or higher)
   - npm
   - Docker and Docker Compose
   - PostgreSQL client tools
3. Set up project directory structure
4. Configure firewall rules to allow traffic on required ports

### Step 2: Database Setup

1. Install PostgreSQL or run via Docker container:
   ```bash
   docker run -d --name postgres-db \
     -e POSTGRES_PASSWORD=bookspassword \
     -e POSTGRES_USER=booksuser \
     -e POSTGRES_DB=booksdb \
     -p 5432:5432 \
     postgres:16
   ```
2. Create the necessary environment variables for database connection
3. Run database migrations using `npm run db:push`

### Step 3: Application Configuration

1. Clone the Ollama-Reader repository to the server
2. Install dependencies: `npm install`
3. Create a production `.env` file with appropriate settings:
   ```
   DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
   PORT=3000
   JWT_SECRET=your-production-jwt-secret
   OLLAMA_HOST=http://localhost:11434
   ```
4. Build the application using the provided build script: `npm run build`

### Step 4: Ollama Service Setup

1. Install Ollama on the server or ensure it's running
2. Download required AI models for book analysis
3. Configure Ollama to run as a service and start automatically

### Step 5: Nginx Configuration

1. Update the existing nginx configuration to proxy requests to the application:
   - API requests (`/api/*`) should be forwarded to the backend server
   - Static assets should be served from the built frontend directory
   - Uploads directory should be accessible at `/uploads/*`
2. Configure SSL certificates for HTTPS (if not already configured)
3. Set up proper caching and security headers

### Step 6: Service Configuration

1. Create systemd service files for:
   - PostgreSQL (if running locally)
   - Ollama service
   - Node.js application
2. Configure services to start automatically on boot
3. Set up proper logging and monitoring

### Step 7: Environment Variables

Ensure the following environment variables are properly configured for production:

- `DATABASE_URL` - Production database connection string
- `JWT_SECRET` - Secret for JWT token generation
- `PORT` - Port for the application to listen on
- `OLLAMA_HOST` - URL for Ollama service
- Any other sensitive configuration values

## Nginx Configuration Details

The existing nginx configuration for reader.market should be updated to handle the application routing:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name reader.market www.reader.market;

    # Proxy API requests to the backend
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve static files from the built frontend
    location / {
        root /var/www/reader.market;
        try_files $uri $uri/ /index.html;
    }

    # Serve uploaded files
    location /uploads {
        alias /path/to/project/uploads;
        expires 30d;
    }
}
```

## Security Considerations

1. **Environment Security**: Store sensitive information in environment variables, not in the codebase
2. **Database Security**: Use strong passwords and limit database access
3. **API Security**: Implement proper authentication and authorization
4. **File Upload Security**: Validate file types and sizes for uploads
5. **SSL/TLS**: Ensure HTTPS is properly configured
6. **Rate Limiting**: Implement rate limiting to prevent abuse

## Backup Strategy

1. Regular database backups using PostgreSQL dump tools
2. Backup of uploaded files and important configuration
3. Version control for application code and configuration files
4. Document the backup and recovery procedures

## Monitoring and Maintenance

1. Set up logging for both frontend and backend applications
2. Monitor application performance and error rates
3. Regular updates for dependencies and security patches
4. Database maintenance and optimization
5. Monitor disk space, especially for uploaded files

## Rollback Plan

1. Maintain previous versions of the application
2. Database migration scripts should be reversible
3. Document the steps to revert to a previous working version
4. Test rollback procedures in a staging environment

## Post-Deployment Verification

1. Verify all application features are working correctly
2. Test user registration and login functionality
3. Verify book upload and reading functionality
4. Test AI analysis features
5. Confirm all API endpoints are accessible
6. Verify file uploads and downloads work properly
7. Check that the nginx proxy configuration is routing correctly
8. Validate SSL certificate if HTTPS is enabled7. Check that the nginx proxy configuration is routing correctly
8. Validate SSL certificate if HTTPS is enabled