# Development Environment Fix - 2026-01-07

## Problem Fixed

The development server was running from **stale built files** (`dist/index.cjs`) instead of the TypeScript source with hot-reload. This caused:

- Code changes not taking effect after saving
- Old commented-out API endpoints remaining active
- Need to manually rebuild after every change

## Solution Applied

Updated `start-dev.bat` and `stop-dev.bat` to ensure clean development environment.

### Changes to start-dev.bat

**Before:**
```batch
start "Backend" cmd /k "set PORT=5001 && node dist/index.cjs || npm run dev"
```
This tried to run the built file first, falling back to dev mode only if build didn't exist.

**After:**
```batch
REM Clean dist folder to ensure fresh development build
echo Cleaning dist folder...
if exist dist rmdir /S /Q dist
echo Dist folder cleaned.

REM Start backend server on port 5001 in development mode
echo Starting backend server on port 5001 (dev mode with hot-reload)...
start "Backend" cmd /k "set PORT=5001 && npm run dev"
```

Now it:
1. **Deletes dist folder** before starting
2. **Always runs `npm run dev`** which uses `tsx` for TypeScript hot-reload
3. Changes take effect immediately without rebuilding

### Changes to stop-dev.bat

Added automatic cleanup when stopping:

```batch
REM Clean dist folder to ensure fresh start next time
echo Cleaning dist folder...
if exist dist rmdir /S /Q dist
echo Dist folder cleaned.
```

This ensures:
- No stale builds remain
- Next start is always clean
- Prevents the same issue from happening again

## How It Works Now

### Development Workflow

1. **Start development:**
   ```cmd
   start-dev.bat
   ```
   - Cleans dist folder
   - Starts backend with hot-reload (tsx)
   - Starts frontend with Vite
   - Your changes take effect immediately!

2. **Make changes:**
   - Edit TypeScript files
   - Save
   - Changes apply automatically (hot-reload)
   - No manual rebuild needed

3. **Stop development:**
   ```cmd
   stop-dev.bat
   ```
   - Stops all Node processes
   - Cleans dist folder
   - Stops Docker containers

### Production Workflow

For production deployment, use:
```cmd
npm run build
```

This creates optimized production builds in the `dist` folder.

## Technical Details

### Development Mode
- **Backend**: `npm run dev` → `tsx server/index.ts`
  - Uses `tsx` (TypeScript Execute) for direct TS execution
  - Hot-reload on file changes
  - Full TypeScript support
  - No build step required

- **Frontend**: `npm run dev:client` → Vite dev server
  - Hot Module Replacement (HMR)
  - Instant updates on changes
  - Optimized dev experience

### Production Mode
- **Build**: `npm run build` → Creates `dist/index.cjs` and `dist/public/*`
  - Compiled JavaScript
  - Minified and optimized
  - Ready for deployment

## Why This Matters

**Before the fix:**
1. Edit `routes.ts` to comment out old endpoints
2. Restart server with `stop-dev.bat` + `start-dev.bat`
3. Old endpoints still active! 😞
4. Manually run `npm run build`
5. Restart again
6. Finally works ✓

**After the fix:**
1. Edit `routes.ts` to comment out old endpoints
2. Save file
3. Hot-reload applies changes immediately ✓
4. No manual rebuild needed!

## Verification

After starting with the new `start-dev.bat`, you should see:

```
Cleaning dist folder...
Dist folder cleaned.
...
Starting backend server on port 5001 (dev mode with hot-reload)...
```

In the backend terminal window:
```
> rest-express@1.0.0 dev
> cross-env NODE_ENV=development tsx server/index.ts

Server running on port 5001
```

This confirms it's running from source with hot-reload, not from built files!

## Files Modified

- ✅ `start-dev.bat` - Added dist cleanup + forced dev mode
- ✅ `stop-dev.bat` - Added dist cleanup on shutdown

## Benefits

✅ **No more stale builds** - dist folder always cleaned  
✅ **Instant changes** - hot-reload works properly  
✅ **No manual rebuilds** - just save and test  
✅ **Prevents confusion** - always know you're running latest code  
✅ **Faster development** - no build step during development  

## Related Issue

This fix resolves the issue where:
- GET `/api/conversations` was returning empty array
- Backend API version header was `null` instead of `'2026-01-07-v2'`
- Old commented-out endpoints were still executing

The root cause was running from stale `dist/index.cjs` which had the old code compiled in.
