# Ollama-Reader Deployment Instructions

This document provides instructions for deploying the Ollama-Reader application to an Ubuntu server with nginx and SSL.

## Prerequisites

- An Ubuntu 20.04+ server with root or sudo access
- A domain name (e.g., `reader.market`) pointing to your server's IP address
- Basic knowledge of Linux command line

## Deployment Steps

### 1. Prepare Your Server

1. Update your server:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Create a non-root user with sudo privileges (recommended):
   ```bash
   sudo adduser deploy
   sudo usermod -aG sudo deploy
   su - deploy
   ```

### 2. Transfer Files to Server

Transfer the deployment script to your server:

```bash
# From your local machine, copy the script to the server
scp deploy-ollama-reader.sh deploy@your-server-ip:/home/deploy/
```

### 3. Run the Deployment Script

1. Connect to your server via SSH:
   ```bash
   ssh deploy@your-server-ip
   ```

2. Make the script executable:
   ```bash
   chmod +x deploy-ollama-reader.sh
   ```

3. Run the deployment script:
   ```bash
   ./deploy-ollama-reader.sh
   ```

### 4. Configure DNS and Obtain SSL Certificate

1. Ensure your domain (e.g., `reader.market`) points to your server's IP address.

2. Once DNS is configured, obtain an SSL certificate:
   ```bash
   sudo certbot --nginx -d reader.market -d www.reader.market --non-interactive --agree-tos --email your-email@example.com
   ```

### 5. Verify the Installation

1. Check if the application is running:
   ```bash
   pm2 status
   ```

2. Check nginx configuration:
   ```bash
   sudo nginx -t
   ```

3. Visit your domain in a browser: `https://reader.market`

## Post-Deployment Configuration

### Database Migrations

If you have new database migrations, run them with:
```bash
cd /var/www/reader.market
npx drizzle-kit push
```

### Environment Variables

Update environment variables in `/var/www/reader.market/.env` as needed.

### Ollama Models

Pull additional Ollama models if needed:
```bash
ollama pull model-name
```

## Managing the Application

### Start/Stop/Restart

- Start: `pm2 start ecosystem.config.js`
- Stop: `pm2 stop ollama-reader`
- Restart: `pm2 restart ollama-reader`
- Reload: `pm2 reload ollama-reader`

### Logs

- View logs: `pm2 logs ollama-reader`
- View logs with lines: `pm2 logs ollama-reader --lines 100`

### Process Management

- List all processes: `pm2 list`
- Monitor: `pm2 monit`
- Save current processes: `pm2 save`

## Updating the Application

Use the provided deployment script to update the application:
```bash
cd /var/www/reader.market
./deploy.sh
```

## Backup and Recovery

### Database Backup

The script creates automatic daily backups. To run a manual backup:
```bash
cd /var/www/reader.market
./backup-db.sh
```

### Backup Location

Database backups are stored in `/var/backups/reader.market/`

## Troubleshooting

### Common Issues

1. **Application not starting**:
   - Check PM2 logs: `pm2 logs`
   - Check if port is in use: `sudo netstat -tuln | grep :5001`
   - Check Node.js version: `node --version`

2. **Database connection issues**:
   - Test database connection: `psql -h localhost -U booksuser -d booksdb -c "SELECT version();"`
   - Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`

3. **SSL certificate issues**:
   - Check certificate status: `sudo certbot certificates`
   - Renew certificate manually: `sudo certbot renew`

4. **Nginx configuration issues**:
   - Test nginx configuration: `sudo nginx -t`
   - Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Health Checks

Run the health check script manually:
```bash
cd /var/www/reader.market
./health-check.sh
```

## Maintenance Tasks

### Daily Tasks
- Monitor application logs
- Check health status
- Verify SSL certificate validity

### Weekly Tasks
- Review system resources
- Update security patches
- Check backup integrity

### Monthly Tasks
- Update application dependencies
- Review and optimize database performance
- Update Ollama models if needed

## Security Considerations

- The firewall (UFW) is configured to allow only SSH, HTTP, and HTTPS
- File permissions are set appropriately
- Environment variables are stored securely
- SSL/TLS is configured with strong ciphers

## Rollback Procedure

To rollback to a previous version:

1. Navigate to the application directory:
   ```bash
   cd /var/www/reader.market
   ```

2. Check git history:
   ```bash
   git log --oneline
   ```

3. Rollback to specific commit:
   ```bash
   git reset --hard [previous-commit-hash]
   ```

4. Reinstall dependencies and rebuild:
   ```bash
   npm ci --only=production
   npm run build
   ```

5. Restart application:
   ```bash
   pm2 restart all
   ```

## Support

If you encounter issues with the deployment:

1. Check the logs first: `pm2 logs`
2. Verify all services are running: `pm2 status`, `sudo systemctl status nginx`, `sudo systemctl status postgresql`
3. Check the troubleshooting section above
4. If issues persist, consult the original deployment guide in `.qoder/quests/unknown-task.md`# Ollama-Reader Deployment Instructions

This document provides instructions for deploying the Ollama-Reader application to an Ubuntu server with nginx and SSL.

## Prerequisites

- An Ubuntu 20.04+ server with root or sudo access
- A domain name (e.g., `reader.market`) pointing to your server's IP address
- Basic knowledge of Linux command line

## Deployment Steps

### 1. Prepare Your Server

1. Update your server:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Create a non-root user with sudo privileges (recommended):
   ```bash
   sudo adduser deploy
   sudo usermod -aG sudo deploy
   su - deploy
   ```

### 2. Transfer Files to Server

Transfer the deployment script to your server:

```bash
# From your local machine, copy the script to the server
scp deploy-ollama-reader.sh deploy@your-server-ip:/home/deploy/
```

### 3. Run the Deployment Script

1. Connect to your server via SSH:
   ```bash
   ssh deploy@your-server-ip
   ```

2. Make the script executable:
   ```bash
   chmod +x deploy-ollama-reader.sh
   ```

3. Run the deployment script:
   ```bash
   ./deploy-ollama-reader.sh
   ```

### 4. Configure DNS and Obtain SSL Certificate

1. Ensure your domain (e.g., `reader.market`) points to your server's IP address.

2. Once DNS is configured, obtain an SSL certificate:
   ```bash
   sudo certbot --nginx -d reader.market -d www.reader.market --non-interactive --agree-tos --email your-email@example.com
   ```

### 5. Verify the Installation

1. Check if the application is running:
   ```bash
   pm2 status
   ```

2. Check nginx configuration:
   ```bash
   sudo nginx -t
   ```

3. Visit your domain in a browser: `https://reader.market`

## Post-Deployment Configuration

### Database Migrations

If you have new database migrations, run them with:
```bash
cd /var/www/reader.market
npx drizzle-kit push
```

### Environment Variables

Update environment variables in `/var/www/reader.market/.env` as needed.

### Ollama Models

Pull additional Ollama models if needed:
```bash
ollama pull model-name
```

## Managing the Application

### Start/Stop/Restart

- Start: `pm2 start ecosystem.config.js`
- Stop: `pm2 stop ollama-reader`
- Restart: `pm2 restart ollama-reader`
- Reload: `pm2 reload ollama-reader`

### Logs

- View logs: `pm2 logs ollama-reader`
- View logs with lines: `pm2 logs ollama-reader --lines 100`

### Process Management

- List all processes: `pm2 list`
- Monitor: `pm2 monit`
- Save current processes: `pm2 save`

## Updating the Application

Use the provided deployment script to update the application:
```bash
cd /var/www/reader.market
./deploy.sh
```

## Backup and Recovery

### Database Backup

The script creates automatic daily backups. To run a manual backup:
```bash
cd /var/www/reader.market
./backup-db.sh
```

### Backup Location

Database backups are stored in `/var/backups/reader.market/`

## Troubleshooting

### Common Issues

1. **Application not starting**:
   - Check PM2 logs: `pm2 logs`
   - Check if port is in use: `sudo netstat -tuln | grep :5001`
   - Check Node.js version: `node --version`

2. **Database connection issues**:
   - Test database connection: `psql -h localhost -U booksuser -d booksdb -c "SELECT version();"`
   - Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`

3. **SSL certificate issues**:
   - Check certificate status: `sudo certbot certificates`
   - Renew certificate manually: `sudo certbot renew`

4. **Nginx configuration issues**:
   - Test nginx configuration: `sudo nginx -t`
   - Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Health Checks

Run the health check script manually:
```bash
cd /var/www/reader.market
./health-check.sh
```

## Maintenance Tasks

### Daily Tasks
- Monitor application logs
- Check health status
- Verify SSL certificate validity

### Weekly Tasks
- Review system resources
- Update security patches
- Check backup integrity

### Monthly Tasks
- Update application dependencies
- Review and optimize database performance
- Update Ollama models if needed

## Security Considerations

- The firewall (UFW) is configured to allow only SSH, HTTP, and HTTPS
- File permissions are set appropriately
- Environment variables are stored securely
- SSL/TLS is configured with strong ciphers

## Rollback Procedure

To rollback to a previous version:

1. Navigate to the application directory:
   ```bash
   cd /var/www/reader.market
   ```

2. Check git history:
   ```bash
   git log --oneline
   ```

3. Rollback to specific commit:
   ```bash
   git reset --hard [previous-commit-hash]
   ```

4. Reinstall dependencies and rebuild:
   ```bash
   npm ci --only=production
   npm run build
   ```

5. Restart application:
   ```bash
   pm2 restart all
   ```

## Support

If you encounter issues with the deployment:

1. Check the logs first: `pm2 logs`
2. Verify all services are running: `pm2 status`, `sudo systemctl status nginx`, `sudo systemctl status postgresql`
3. Check the troubleshooting section above
4. If issues persist, consult the original deployment guide in `.qoder/quests/unknown-task.md`