#!/bin/bash

# Ollama-Reader Deployment Script for Ubuntu Server
# This script automates the deployment of Ollama-Reader on Ubuntu with nginx and SSL
# Domain: reader.market

set -e  # Exit immediately if a command exits with a non-zero status

# Configuration variables
APP_DIR="/var/www/reader.market"
BACKUP_DIR="/var/backups/reader.market"
DB_NAME="booksdb"
DB_USER="booksuser"
DB_PASS="bookspassword"
APP_PORT=5001
DOMAIN_NAME="reader.market"
EMAIL="admin@$DOMAIN_NAME"

echo "========================================="
echo "Ollama-Reader Deployment Script"
echo "========================================="
echo "Domain: $DOMAIN_NAME"
echo "Application directory: $APP_DIR"
echo "Database: $DB_NAME"
echo "========================================="

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a service is running
service_running() {
    systemctl is-active --quiet "$1"
}

# Function to wait for a service to be ready
wait_for_service() {
    local service=$1
    local timeout=30
    local count=0
    
    while [ $count -lt $timeout ]; do
        if service_running "$service"; then
            log "$service is running"
            return 0
        fi
        sleep 1
        ((count++))
    done
    
    log "ERROR: $service did not start within $timeout seconds"
    return 1
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    log "This script should not be run as root. Please run as a regular user with sudo access."
    exit 1
fi

# Check if sudo is available
if ! command_exists sudo; then
    log "ERROR: sudo is not installed. Please install sudo first."
    exit 1
fi

log "Starting Ollama-Reader deployment..."

# 1. Update system packages
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install essential packages
log "Installing essential packages..."
sudo apt install -y curl wget git build-essential

# 3. Install Node.js and npm
log "Installing Node.js LTS..."
if ! command_exists node; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
else
    log "Node.js already installed: $(node --version)"
fi

log "Node.js version: $(node --version)"
log "npm version: $(npm --version)"

# 4. Install PM2 Process Manager
log "Installing PM2..."
if ! command_exists pm2; then
    sudo npm install -g pm2
else
    log "PM2 already installed"
fi

# 5. Enable PM2 startup
log "Setting up PM2 startup..."
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER

# 6. Install PostgreSQL
log "Installing PostgreSQL..."
if ! command_exists psql; then
    sudo apt install postgresql postgresql-contrib -y
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
else
    log "PostgreSQL already installed"
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# Wait for PostgreSQL to be ready
wait_for_service postgresql

# 7. Configure PostgreSQL Database
log "Configuring PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true

# 8. Install Ollama
log "Installing Ollama..."
if ! command_exists ollama; then
    curl -fsSL https://ollama.ai/install.sh | sh
    sudo systemctl start ollama
    sudo systemctl enable ollama
else
    log "Ollama already installed"
    sudo systemctl start ollama
    sudo systemctl enable ollama
fi

# Wait for Ollama to be ready
wait_for_service ollama

# 9. Pull required models
log "Pulling Ollama models..."
ollama pull llama2 || log "Warning: Could not pull llama2 model"
ollama pull mistral || log "Warning: Could not pull mistral model"

# 10. Create project directory structure
log "Creating project directory structure..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR
cd $APP_DIR

# 11. Clone the repository (assuming it's available)
# Since we're in the current project, we'll copy the files instead of cloning
log "Setting up project files..."
if [ -d "/tmp/ollama-reader-source" ]; then
    cp -r /tmp/ollama-reader-source/* .
else
    # If not running from source, create the directory structure
    mkdir -p client/src/components
    mkdir -p server
    mkdir -p shared
    mkdir -p migrations
    mkdir -p uploads
    mkdir -p logs
    touch package.json
fi

# 12. Copy current project files (simulating the clone process)
log "Copying project files..."
rsync -av --exclude 'node_modules' --exclude 'dist' --exclude '.git' /c/Projects/Ollama-Reader/ $APP_DIR/

# 13. Install project dependencies
log "Installing project dependencies..."
cd $APP_DIR

# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..

# Install production-only dependencies
npm ci --only=production

# 14. Create production build
log "Creating production build..."
npm run build

# 15. Create environment configuration
log "Creating environment configuration..."
cat > .env << EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public
PORT=$APP_PORT
JWT_SECRET=$(openssl rand -base64 32)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2
NODE_ENV=production
EOF

# 16. Create uploads directory
log "Creating uploads directory..."
mkdir -p uploads
sudo chown -R $USER:$USER uploads
chmod -R 755 uploads

# 17. Run database migrations
log "Running database migrations..."
npx drizzle-kit push

# 18. Create PM2 configuration
log "Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'ollama-reader',
    script: './dist/index.cjs',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT,
      DATABASE_URL: 'postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public',
      JWT_SECRET: '$(openssl rand -base64 32)',
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

# 19. Create logs directory and start application
log "Starting application with PM2..."
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save

# 20. Install nginx
log "Installing nginx..."
if ! command_exists nginx; then
    sudo apt install nginx -y
    sudo systemctl start nginx
    sudo systemctl enable nginx
else
    log "nginx already installed"
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi

# 21. Create nginx site configuration
log "Creating nginx site configuration..."
sudo tee /etc/nginx/sites-available/reader.market << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;
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
    client_max_body_size 50M;

    # Logging
    access_log /var/log/nginx/reader.market.access.log;
    error_log /var/log/nginx/reader.market.error.log;

    # Serve static assets directly
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root $APP_DIR/dist/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to Node.js server
    location /api {
        proxy_pass http://127.0.0.1:$APP_PORT;
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
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Allow larger file uploads
        client_max_body_size 50M;
    }

    # Serve all other requests from the React app
    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
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

# 22. Enable nginx site
log "Enabling nginx site..."
sudo ln -sf /etc/nginx/sites-available/reader.market /etc/nginx/sites-enabled/

# 23. Test nginx configuration
log "Testing nginx configuration..."
sudo nginx -t

# 24. Reload nginx
log "Reloading nginx..."
sudo systemctl reload nginx

# 25. Install Certbot for SSL
log "Installing Certbot for SSL certificates..."
sudo apt install certbot python3-certbot-nginx -y

# 26. Configure firewall
log "Configuring UFW firewall..."
sudo ufw enable << EOF
y
EOF
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# 27. Set up file permissions
log "Setting up file permissions..."
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR
sudo chown -R $USER:www-data $APP_DIR/uploads
sudo chmod -R 775 $APP_DIR/uploads

# 28. Set up log rotation
log "Setting up log rotation..."
sudo tee /etc/logrotate.d/ollama-reader << EOF
$APP_DIR/logs/*.log {
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

# 29. Create backup script
log "Creating backup script..."
cat > backup-db.sh << EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_DIR"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"

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

# 30. Set up regular backups
log "Setting up regular backups..."
mkdir -p $BACKUP_DIR
(crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup-db.sh") | crontab -

# 31. Create deployment script
log "Creating deployment script..."
cat > deploy.sh << EOF
#!/bin/bash

# Ollama-Reader deployment script
APP_DIR="$APP_DIR"
BACKUP_DIR="$BACKUP_DIR"

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

# 32. Create health check script
log "Creating health check script..."
cat > health-check.sh << EOF
#!/bin/bash

# Check if application is responding
HTTP_CODE=\$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN_NAME/api/health 2>/dev/null || echo "000")

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

# 33. Set up health check cron
log "Setting up health check cron..."
(crontab -l 2>/dev/null; echo "*/10 * * * * $APP_DIR/health-check.sh") | crontab -

# 34. Final status check
log "Checking application status..."
pm2 status

log "========================================="
log "Deployment completed successfully!"
log "========================================="
log "Application is running at: https://$DOMAIN_NAME"
log "PM2 status: Run 'pm2 status' to check application status"
log "Nginx status: Run 'sudo systemctl status nginx' to check nginx status"
log "PostgreSQL status: Run 'sudo systemctl status postgresql' to check database status"
log "Ollama status: Run 'sudo systemctl status ollama' to check AI service status"
log "========================================="

# Instructions for SSL certificate (needs to be done manually after DNS is set up)
log "IMPORTANT: SSL certificate needs to be obtained manually after DNS is configured:"
log "Run: sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email $EMAIL"
log "========================================="#!/bin/bash

# Ollama-Reader Deployment Script for Ubuntu Server
# This script automates the deployment of Ollama-Reader on Ubuntu with nginx and SSL
# Domain: reader.market

set -e  # Exit immediately if a command exits with a non-zero status

# Configuration variables
APP_DIR="/var/www/reader.market"
BACKUP_DIR="/var/backups/reader.market"
DB_NAME="booksdb"
DB_USER="booksuser"
DB_PASS="bookspassword"
APP_PORT=5001
DOMAIN_NAME="reader.market"
EMAIL="admin@$DOMAIN_NAME"

echo "========================================="
echo "Ollama-Reader Deployment Script"
echo "========================================="
echo "Domain: $DOMAIN_NAME"
echo "Application directory: $APP_DIR"
echo "Database: $DB_NAME"
echo "========================================="

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a service is running
service_running() {
    systemctl is-active --quiet "$1"
}

# Function to wait for a service to be ready
wait_for_service() {
    local service=$1
    local timeout=30
    local count=0
    
    while [ $count -lt $timeout ]; do
        if service_running "$service"; then
            log "$service is running"
            return 0
        fi
        sleep 1
        ((count++))
    done
    
    log "ERROR: $service did not start within $timeout seconds"
    return 1
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    log "This script should not be run as root. Please run as a regular user with sudo access."
    exit 1
fi

# Check if sudo is available
if ! command_exists sudo; then
    log "ERROR: sudo is not installed. Please install sudo first."
    exit 1
fi

log "Starting Ollama-Reader deployment..."

# 1. Update system packages
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install essential packages
log "Installing essential packages..."
sudo apt install -y curl wget git build-essential

# 3. Install Node.js and npm
log "Installing Node.js LTS..."
if ! command_exists node; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
else
    log "Node.js already installed: $(node --version)"
fi

log "Node.js version: $(node --version)"
log "npm version: $(npm --version)"

# 4. Install PM2 Process Manager
log "Installing PM2..."
if ! command_exists pm2; then
    sudo npm install -g pm2
else
    log "PM2 already installed"
fi

# 5. Enable PM2 startup
log "Setting up PM2 startup..."
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER

# 6. Install PostgreSQL
log "Installing PostgreSQL..."
if ! command_exists psql; then
    sudo apt install postgresql postgresql-contrib -y
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
else
    log "PostgreSQL already installed"
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# Wait for PostgreSQL to be ready
wait_for_service postgresql

# 7. Configure PostgreSQL Database
log "Configuring PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true

# 8. Install Ollama
log "Installing Ollama..."
if ! command_exists ollama; then
    curl -fsSL https://ollama.ai/install.sh | sh
    sudo systemctl start ollama
    sudo systemctl enable ollama
else
    log "Ollama already installed"
    sudo systemctl start ollama
    sudo systemctl enable ollama
fi

# Wait for Ollama to be ready
wait_for_service ollama

# 9. Pull required models
log "Pulling Ollama models..."
ollama pull llama2 || log "Warning: Could not pull llama2 model"
ollama pull mistral || log "Warning: Could not pull mistral model"

# 10. Create project directory structure
log "Creating project directory structure..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR
cd $APP_DIR

# 11. Clone the repository (assuming it's available)
# Since we're in the current project, we'll copy the files instead of cloning
log "Setting up project files..."
if [ -d "/tmp/ollama-reader-source" ]; then
    cp -r /tmp/ollama-reader-source/* .
else
    # If not running from source, create the directory structure
    mkdir -p client/src/components
    mkdir -p server
    mkdir -p shared
    mkdir -p migrations
    mkdir -p uploads
    mkdir -p logs
    touch package.json
fi

# 12. Copy current project files (simulating the clone process)
log "Copying project files..."
rsync -av --exclude 'node_modules' --exclude 'dist' --exclude '.git' /c/Projects/Ollama-Reader/ $APP_DIR/

# 13. Install project dependencies
log "Installing project dependencies..."
cd $APP_DIR

# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..

# Install production-only dependencies
npm ci --only=production

# 14. Create production build
log "Creating production build..."
npm run build

# 15. Create environment configuration
log "Creating environment configuration..."
cat > .env << EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public
PORT=$APP_PORT
JWT_SECRET=$(openssl rand -base64 32)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2
NODE_ENV=production
EOF

# 16. Create uploads directory
log "Creating uploads directory..."
mkdir -p uploads
sudo chown -R $USER:$USER uploads
chmod -R 755 uploads

# 17. Run database migrations
log "Running database migrations..."
npx drizzle-kit push

# 18. Create PM2 configuration
log "Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'ollama-reader',
    script: './dist/index.cjs',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT,
      DATABASE_URL: 'postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public',
      JWT_SECRET: '$(openssl rand -base64 32)',
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

# 19. Create logs directory and start application
log "Starting application with PM2..."
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save

# 20. Install nginx
log "Installing nginx..."
if ! command_exists nginx; then
    sudo apt install nginx -y
    sudo systemctl start nginx
    sudo systemctl enable nginx
else
    log "nginx already installed"
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi

# 21. Create nginx site configuration
log "Creating nginx site configuration..."
sudo tee /etc/nginx/sites-available/reader.market << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;
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
    client_max_body_size 50M;

    # Logging
    access_log /var/log/nginx/reader.market.access.log;
    error_log /var/log/nginx/reader.market.error.log;

    # Serve static assets directly
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root $APP_DIR/dist/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to Node.js server
    location /api {
        proxy_pass http://127.0.0.1:$APP_PORT;
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
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Allow larger file uploads
        client_max_body_size 50M;
    }

    # Serve all other requests from the React app
    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
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

# 22. Enable nginx site
log "Enabling nginx site..."
sudo ln -sf /etc/nginx/sites-available/reader.market /etc/nginx/sites-enabled/

# 23. Test nginx configuration
log "Testing nginx configuration..."
sudo nginx -t

# 24. Reload nginx
log "Reloading nginx..."
sudo systemctl reload nginx

# 25. Install Certbot for SSL
log "Installing Certbot for SSL certificates..."
sudo apt install certbot python3-certbot-nginx -y

# 26. Configure firewall
log "Configuring UFW firewall..."
sudo ufw enable << EOF
y
EOF
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# 27. Set up file permissions
log "Setting up file permissions..."
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR
sudo chown -R $USER:www-data $APP_DIR/uploads
sudo chmod -R 775 $APP_DIR/uploads

# 28. Set up log rotation
log "Setting up log rotation..."
sudo tee /etc/logrotate.d/ollama-reader << EOF
$APP_DIR/logs/*.log {
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

# 29. Create backup script
log "Creating backup script..."
cat > backup-db.sh << EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_DIR"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"

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

# 30. Set up regular backups
log "Setting up regular backups..."
mkdir -p $BACKUP_DIR
(crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup-db.sh") | crontab -

# 31. Create deployment script
log "Creating deployment script..."
cat > deploy.sh << EOF
#!/bin/bash

# Ollama-Reader deployment script
APP_DIR="$APP_DIR"
BACKUP_DIR="$BACKUP_DIR"

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

# 32. Create health check script
log "Creating health check script..."
cat > health-check.sh << EOF
#!/bin/bash

# Check if application is responding
HTTP_CODE=\$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN_NAME/api/health 2>/dev/null || echo "000")

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

# 33. Set up health check cron
log "Setting up health check cron..."
(crontab -l 2>/dev/null; echo "*/10 * * * * $APP_DIR/health-check.sh") | crontab -

# 34. Final status check
log "Checking application status..."
pm2 status

log "========================================="
log "Deployment completed successfully!"
log "========================================="
log "Application is running at: https://$DOMAIN_NAME"
log "PM2 status: Run 'pm2 status' to check application status"
log "Nginx status: Run 'sudo systemctl status nginx' to check nginx status"
log "PostgreSQL status: Run 'sudo systemctl status postgresql' to check database status"
log "Ollama status: Run 'sudo systemctl status ollama' to check AI service status"
log "========================================="

# Instructions for SSL certificate (needs to be done manually after DNS is set up)
log "IMPORTANT: SSL certificate needs to be obtained manually after DNS is configured:"
log "Run: sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email $EMAIL"
log "========================================="