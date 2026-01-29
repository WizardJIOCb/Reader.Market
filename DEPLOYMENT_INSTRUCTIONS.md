# Deployment Instructions for Production Server

## Method 1: Direct deployment on server (Recommended)

SSH into the production server and run:

```bash
# Download the deployment script
wget https://raw.githubusercontent.com/WizardJIOCb/Reader.Market/main/production-deploy.sh

# Make it executable
chmod +x production-deploy.sh

# Run the deployment
./production-deploy.sh
```

## Method 2: Manual deployment on server

1. **SSH into production server:**
   ```bash
   ssh root@82.146.42.213
   ```

2. **Navigate to project directory:**
   ```bash
   cd /var/www/reader.market
   ```

3. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

4. **Install/update dependencies:**
   ```bash
   npm install
   ```

5. **Build the project:**
   ```bash
   npm run build
   ```

6. **Restart the application:**
   ```bash
   pm2 restart all
   ```

## Verification

After deployment, check:
1. https://reader.market/git-to-gpt should show the new React interface
2. The cache=false parameter should work
3. All translations should be present
4. The calendar should display correctly

## Troubleshooting

If the old interface still shows:
1. Clear browser cache
2. Check that PM2 restarted correctly: `pm2 list`
3. Verify files were copied: `ls -la /var/www/reader.market/dist/public/`
4. Check server logs: `pm2 logs`