# PDF Worker MIME Type Issue Investigation

## Date
2026-01-19

## Problem Summary
PDF.js worker module fails to load with error:
```
Failed to parse PDF: Setting up fake worker failed: "Failed to fetch dynamically imported module: https://reader.market/assets/pdf.worker.min-LyOxJPrg.mjs"
```

Additionally, images stopped loading (404 errors) after nginx configuration changes.

## Investigation Findings

### 1. PDF Worker File Accessibility
- File exists on server: `/var/www/reader.market/dist/public/assets/pdf.worker.min-LyOxJPrg.mjs` (1.07 MB)
- File is accessible via HTTP: Returns 200 OK
- **Issue**: File served with `Content-Type: application/octet-stream`
- **Required**: File must be served with `text/javascript` or `application/javascript` MIME type

### 2. Browser Behavior
Modern browsers reject dynamic imports of `.mjs` files when served with incorrect MIME types. The `application/octet-stream` MIME type causes the browser to refuse executing the module as JavaScript.

### 3. Image Upload Issue
- Images return 404: `https://reader.market/uploads/coverImage-*.jpg`
- Root cause: nginx static file regex `^/.*\.(js|mjs|css|...)$` may be interfering with `/uploads` proxy location
- The `/uploads` location block must proxy to Node.js backend (port 5001)

## Root Causes

1. **MIME Type Misconfiguration**: Nginx serves `.mjs` files with default `application/octet-stream` instead of JavaScript MIME type
2. **Location Block Order**: Static assets regex may be catching `/uploads` requests before they reach the proxy block
3. **Missing Type Definition**: No explicit MIME type mapping for `.mjs` extension in nginx config

## Solution

### Nginx Configuration Fix

Add explicit MIME type handling for `.mjs` files in the static assets block:

```nginx
# Serve static assets directly with correct MIME types
location ~* ^/assets/.*\.(js|mjs|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    root /var/www/reader.market/dist/public;
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
    
    # Fix MIME type for .mjs files (required for PDF.js worker)
    location ~* \.mjs$ {
        types { text/javascript mjs; }
        add_header Cache-Control "public, immutable";
        expires 1y;
    }
}

# Ensure /uploads proxy location exists and is ABOVE the main location / block
location /uploads {
    proxy_pass http://127.0.0.1:5001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    client_max_body_size 100M;
}
```

### Deployment Steps

```bash
# SSH to server
ssh root@82.146.42.213

# Edit nginx config
sudo nano /etc/nginx/sites-available/reader.market

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Verify PDF worker MIME type
curl -I https://reader.market/assets/pdf.worker.min-LyOxJPrg.mjs | grep Content-Type
# Should show: Content-Type: text/javascript

# Verify image access
curl -I https://reader.market/uploads/coverImage-1767294097388-554283870.jpg
# Should show: 200 OK
```

## Technical Details

### MIME Type Standards
- `.mjs` files are ES modules and must be served as JavaScript
- Accepted MIME types: `text/javascript`, `application/javascript`
- Browsers enforce strict MIME type checking for module imports per ES6 spec

### PDF.js Worker Architecture
- PDF.js uses Web Workers for off-main-thread PDF parsing
- Worker is loaded via dynamic import: `import(workerUrl)`
- Dynamic imports require correct MIME type or browser rejects the module
- Worker path configured in: `client/src/components/reader/ReaderEngine.ts:20`

### Current Configuration
- Worker hardcoded to: `/assets/pdf.worker.min-LyOxJPrg.mjs`
- File manually copied from: `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
- Build process does not auto-include worker (Vite bundling issue)

## Related Issues

- Memory ID: `a29667a6-c317-480a-a0e9-7ead669fdba4` - Fix MJS File MIME Type in Nginx
- Commit: `c9d6195` - Fix PDF.js worker loading with absolute path to bundled asset

## References

- MDN: [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- PDF.js: [Getting Started](https://mozilla.github.io/pdf.js/getting_started/)
- Nginx: [MIME Types](http://nginx.org/en/docs/http/ngx_http_core_module.html#types)
