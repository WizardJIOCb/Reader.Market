# Deployment Guide: Ollama-Reader on Ubuntu Server

## 1. Server Setup and Prerequisites

### 1.1 System Requirements
- Ubuntu 20.04 LTS or higher
- Minimum 2GB RAM (4GB+ recommended)
- At least 10GB free disk space
- Root or sudo access to the server
- Domain name: `reader.market` pointing to the server IP

### 1.2 Initial Server Configuration
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential
```

### 1.3 Install Node.js and npm
```bash
# Install NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

# Install Node.js LTS
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 1.4 Install PM2 Process Manager
```bash
# Install PM2 globally
sudo npm install -g pm2

# Enable PM2 startup
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u [your-username] --hp /home/[your-username]
```

## 2. Database Setup

### 2.1 Install PostgreSQL
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.2 Configure PostgreSQL Database
```bash
# Switch to postgres user
sudo -u postgres psql

# Execute the following commands in PostgreSQL:
CREATE DATABASE booksdb;
CREATE USER booksuser WITH PASSWORD 'bookspassword';
GRANT ALL PRIVILEGES ON DATABASE booksdb TO booksuser;
\q
```

### 2.3 Install Additional Database Tools (Optional)
```bash
# Install additional PostgreSQL tools
sudo apt install postgresql-client-common postgresql-client -y
```

## 3. Install Ollama (AI Service)

### 3.1 Download and Install Ollama
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
sudo systemctl start ollama
sudo systemctl enable ollama
```

### 3.2 Configure Ollama Models
```bash
# Pull required models
ollama pull llama2
ollama pull mistral
```

## 4. Project Setup

### 4.1 Create Project Directory Structure
```bash
# Create project directory
sudo mkdir -p /var/www/reader.market
sudo chown $USER:$USER /var/www/reader.market
cd /var/www/reader.market
```

### 4.2 Clone the Repository
```bash
# Clone the project
git clone https://github.com/[your-repo]/Ollama-Reader.git .
```

### 4.3 Install Project Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies (if not already included in main dependencies)
cd client
npm install
cd ..

# Install production-only dependencies
npm ci --only=production
```

## 5. Build Configuration

### 5.1 Create Production Build
```bash
# Build the application
npm run build
```

### 5.2 Environment Configuration
Create the environment file with production settings:
```bash
cat > .env << EOF
DATABASE_URL=postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public
PORT=5001
JWT_SECRET=your_production_secret_key_for_jwt_tokens
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2
NODE_ENV=production
EOF
```

### 5.3 Create Uploads Directory
```bash
# Create uploads directory with proper permissions
mkdir -p uploads
sudo chown -R $USER:$USER uploads
chmod -R 755 uploads
```

## 6. Database Migration

### 6.1 Run Database Migrations
```bash
# Run database migrations
npx drizzle-kit push
```

### 6.2 Alternative: Apply Migration Files Directly
```bash
# If using SQL migration files
psql -h localhost -U booksuser -d booksdb -f migrations/0000_green_impossible_man.sql
psql -h localhost -U booksuser -d booksdb -f migrations/0001_add_book_dates.sql
```

## 7. PM2 Process Configuration

### 7.1 Create PM2 Configuration File
Create a process configuration file for PM2:
```bash
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'ollama-reader',
    script: './dist/index.cjs',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
      DATABASE_URL: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
      JWT_SECRET: 'your_production_secret_key_for_jwt_tokens',
      OLLAMA_HOST: 'http://localhost:11434',
      OLLAMA_MODEL: 'llama2'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G'
  }]
};
EOF
```

### 7.2 Start Application with PM2
```bash
# Create logs directory
mkdir -p logs

# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Check application status
pm2 status
```

## 8. Nginx Configuration

### 8.1 Install Nginx
```bash
# Install nginx
sudo apt install nginx -y

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 8.2 Create Nginx Site Configuration
Create the nginx configuration file:
```bash
sudo tee /etc/nginx/sites-available/reader.market << EOF
server {
    listen 80;
    server_name reader.market www.reader.market;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reader.market www.reader.market;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/reader.market/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reader.market/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Client max body size for file uploads
    client_max_body_size 100M;

    # Logging
    access_log /var/log/nginx/reader.market.access.log;
    error_log /var/log/nginx/reader.market.error.log;

    # Serve static assets directly
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/reader.market/dist/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to Node.js server
    location /api {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
    }

    # Proxy uploads requests to Node.js server
    location /uploads {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Allow larger file uploads
        client_max_body_size 100M;
    }

    # Serve all other requests from the React app
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
```

### 8.3 Enable Site and Test Configuration
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/reader.market /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx to apply changes
sudo systemctl reload nginx
```

## 9. SSL Certificate Setup

### 9.1 Install Certbot
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y
```

### 9.2 Obtain SSL Certificate
```bash
# Obtain SSL certificate using certbot
sudo certbot --nginx -d reader.market -d www.reader.market --non-interactive --agree-tos --email your-email@example.com
```

### 9.3 Set Up Automatic Certificate Renewal
```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Cron job is automatically set up by certbot, but you can verify:
sudo crontab -l
```

## 10. Security Configuration

### 10.1 Configure Firewall
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (important - otherwise you might lose access)
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Check firewall status
sudo ufw status
```

### 10.2 Set Up File Permissions
```bash
# Set appropriate permissions for the project directory
sudo chown -R www-data:www-data /var/www/reader.market
sudo chmod -R 755 /var/www/reader.market

# Ensure uploads directory is writable by the application
sudo chown -R $USER:www-data /var/www/reader.market/uploads
sudo chmod -R 775 /var/www/reader.market/uploads
```

## 11. Monitoring and Logging

### 11.1 Set Up Log Rotation
Create a log rotation configuration:
```bash
sudo tee /etc/logrotate.d/ollama-reader << EOF
/var/www/reader.market/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        # Reload PM2 logs
        /usr/bin/pm2 reloadLogs
    endscript
}
EOF
```

### 11.2 Monitor Application Status
```bash
# Check PM2 status
pm2 status

# Monitor logs
pm2 logs

# Check nginx status
sudo systemctl status nginx

# Check PostgreSQL status
sudo systemctl status postgresql

# Check Ollama status
sudo systemctl status ollama
```

## 12. Backup Procedures

### 12.1 Database Backup Script
Create a backup script:
```bash
cat > backup-db.sh << EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/reader.market"
DB_NAME="booksdb"
DB_USER="booksuser"

# Create backup directory if it doesn't exist
mkdir -p \$BACKUP_DIR

# Create database backup
pg_dump -h localhost -U \$DB_USER -d \$DB_NAME > \$BACKUP_DIR/db_backup_\$DATE.sql

# Compress the backup
gzip \$BACKUP_DIR/db_backup_\$DATE.sql

# Remove backups older than 30 days
find \$BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Database backup completed: db_backup_\$DATE.sql.gz"
EOF

chmod +x backup-db.sh
```

### 12.2 Set Up Regular Backups
```bash
# Add backup to crontab
crontab -l | { cat; echo "0 2 * * * /var/www/reader.market/backup-db.sh"; } | crontab -
```

## 13. Deployment Automation Script

### 13.1 Create Update Script
Create a script to automate updates:
```bash
cat > deploy.sh << EOF
#!/bin/bash

# Ollama-Reader deployment script
APP_DIR="/var/www/reader.market"
BACKUP_DIR="/var/backups/reader.market"

echo "Starting deployment..."

# Create timestamped backup
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
echo "Creating backup..."
cp -r \$APP_DIR \$BACKUP_DIR/deploy_backup_\$TIMESTAMP

# Navigate to app directory
cd \$APP_DIR

# Pull latest changes
git fetch origin
git reset --hard origin/main

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Restart PM2 processes
pm2 reload all

echo "Deployment completed successfully!"
EOF

chmod +x deploy.sh
```

## 14. Health Checks and Maintenance

### 14.1 Application Health Check
Create a health check script:
```bash
cat > health-check.sh << EOF
#!/bin/bash

# Check if application is responding
HTTP_CODE=\$(curl -s -o /dev/null -w "%{http_code}" https://reader.market/api/health)

if [ \$HTTP_CODE -eq 200 ]; then
    echo "Application is healthy (HTTP \$HTTP_CODE)"
    exit 0
else
    echo "Application is unhealthy (HTTP \$HTTP_CODE)"
    # Optionally restart the application
    # pm2 restart all
    exit 1
fi
EOF

chmod +x health-check.sh
```

### 14.2 Set Up Health Check Cron
```bash
# Add health check to crontab
crontab -l | { cat; echo "*/10 * * * * /var/www/reader.market/health-check.sh"; } | crontab -
```

## 15. Troubleshooting

### 15.1 Common Issues and Solutions

#### Application Not Starting
```bash
# Check PM2 logs
pm2 logs

# Check if port is in use
sudo netstat -tuln | grep :5001

# Check Node.js version
node --version
```

#### Database Connection Issues
```bash
# Test database connection
psql -h localhost -U booksuser -d booksdb -c "SELECT version();"

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew
```

#### Nginx Configuration Issues
```bash
# Test nginx configuration
sudo nginx -t

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### 15.2 Performance Monitoring
```bash
# Monitor system resources
htop

# Monitor application logs
pm2 logs --lines 100

# Check disk space
df -h

# Check memory usage
free -h
```

## 16. Rollback Procedure

### 16.1 Rollback to Previous Version
```bash
# If using git, you can rollback to a previous commit
cd /var/www/reader.market

# Check git history
git log --oneline

# Rollback to specific commit
git reset --hard [previous-commit-hash]

# Reinstall dependencies and rebuild
npm ci --only=production
npm run build

# Restart application
pm2 restart all
```

### 16.2 Restore from Backup
```bash
# Restore database from backup
gunzip -c /var/backups/reader.market/db_backup_[timestamp].sql.gz | psql -h localhost -U booksuser -d booksdb
```

## 17. Maintenance Schedule

### 17.1 Daily Tasks
- Monitor application logs
- Check health status
- Verify SSL certificate validity

### 17.2 Weekly Tasks
- Review system resources
- Update security patches
- Check backup integrity

### 17.3 Monthly Tasks
- Update application dependencies
- Review and optimize database performance
- Update Ollama models if needed