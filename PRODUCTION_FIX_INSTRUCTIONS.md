# Production Build Fix Instructions

## Issue
The build process on the production server is failing because `esbuild`, `vite`, and `tsx` are required by the build script (`script/build.ts`) but are only installed as devDependencies. In production environments, only production dependencies are installed using `npm ci --only=production`. The `tsx` package is required to execute the build command `tsx script/build.ts`.

## Solution
This document provides instructions to fix the dependency issue on the production server.

## Steps to Fix

### 1. Copy the fix script to the production server
First, copy the `fix-production-deps.cjs` script to your production server in the `/var/www/reader.market` directory.

### 2. Run the fix script on the production server
On your production server, execute the following commands:

```bash
cd /var/www/reader.market
node fix-production-deps.cjs
```

This script will automatically move `esbuild`, `vite`, and `tsx` from `devDependencies` to `dependencies` in your `package.json` file.

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

## Alternative Manual Method
If you prefer to manually edit the `package.json` file:

1. Open `/var/www/reader.market/package.json`
2. Find the `esbuild` entry in `devDependencies` and move it to `dependencies`
3. Find the `vite` entry in `devDependencies` and move it to `dependencies`
4. Find the `tsx` entry in `devDependencies` and move it to `dependencies`
5. Remove all three entries from `devDependencies`
6. Save the file
7. Run `npm install`
8. Run `npm run build`

## Verification
After applying the fix, the build should complete successfully without the "Cannot find package" error.

## Future Considerations
To prevent this issue in future deployments:
1. Consider adding `esbuild`, `vite`, and `tsx` to `dependencies` in your development `package.json`
2. Update your deployment process to ensure build dependencies are available during production builds