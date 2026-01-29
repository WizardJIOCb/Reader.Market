@echo off
echo Starting deployment to production server...

echo Building frontend...
npm run build

echo Copying files to production server...
pscp -r dist\* root@82.146.42.213:/var/www/reader.market/dist/

echo Restarting server...
plink root@82.146.42.213 "cd /var/www/reader.market && pm2 restart all"

echo Deployment completed!
pause