# Comprehensive Production Build Fix Instructions

## Issue
The build process on the production server is failing because several packages required during the build process are only installed as devDependencies. In production environments, only production dependencies are installed using `npm ci --only=production`.

## Solution
This document provides instructions to fix all dependency issues on the production server.

## Steps to Fix

### 1. Copy the comprehensive fix script to the production server
First, copy the `fix-production-deps-complete.cjs` script to your production server in the `/var/www/reader.market` directory.

### 2. Run the comprehensive fix script on the production server
On your production server, execute the following commands:

```bash
cd /var/www/reader.market
node fix-production-deps-complete.cjs
```

This script will automatically move all required build dependencies (`esbuild`, `vite`, `tsx`, and `@vitejs/plugin-react`) from `devDependencies` to `dependencies` in your `package.json` file.

### 3. Install the updated dependencies
After running the script, install the updated dependencies:

```bash
npm install
```

### 4. Test the build
Now try running the build command again:

```bash
npm run build
```

## Additional Build Dependencies
The following dependencies are required for the build process and will be moved to production dependencies:
- `esbuild` - Required by the build script
- `vite` - Required by the build script
- `tsx` - Required to execute the build command `tsx script/build.ts`
- `@vitejs/plugin-react` - Required by the Vite configuration during the build
- `@tailwindcss/vite` - Required by the Vite configuration during the build
- `@replit/vite-plugin-runtime-error-modal` - Required by the Vite configuration during the build
- `@replit/vite-plugin-cartographer` - Required by the Vite configuration during the build
- `@replit/vite-plugin-dev-banner` - Required by the Vite configuration during the build

## Verification
After applying the fix, the build should complete successfully without any "Cannot find package" errors.

## Future Considerations
To prevent this issue in future deployments:
1. Consider adding all build-time dependencies to `dependencies` in your development `package.json`
2. Update your deployment process to ensure build dependencies are available during production builds