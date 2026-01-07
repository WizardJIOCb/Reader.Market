# Fix Socket.io-client Import Resolution in Production Build

## Objective

Resolve the Rollup build failure where `socket.io-client` cannot be imported during production build on the server, while maintaining full WebSocket functionality for real-time messaging features.

## Problem Analysis

### Root Cause
The build process fails with error: `Rollup failed to resolve import "socket.io-client" from "/var/www/reader.market/client/src/lib/socket.ts"`

This occurs because:
- Vite's Rollup bundler cannot resolve the `socket.io-client` package during production build
- The package is installed in `dependencies` (confirmed in package.json line 89)
- The import statement in `socket.ts` is valid: `import { io, Socket } from 'socket.io-client';`
- This is a bundler configuration issue, not a missing dependency issue

### Impact
- Production build cannot complete on server
- Application cannot be deployed
- WebSocket-based features (real-time messaging, typing indicators, reactions) are blocked

## Solution Strategy

### Approach: Configure Vite Rollup Options

Add explicit Rollup configuration to handle `socket.io-client` as an optimized dependency and ensure proper resolution during build.

**Rationale**: Vite's default bundling may not properly handle socket.io-client's complex ESM/CommonJS structure. Explicit configuration ensures the bundler treats it correctly.

## Design

### Configuration Changes

#### Vite Configuration Update

Location: `vite.config.ts`

Add the following configuration options to the Vite config:

| Configuration Section | Purpose | Values |
|----------------------|---------|---------|
| `optimizeDeps.include` | Pre-bundle socket.io-client during dev | Add `'socket.io-client'` to existing array |
| `build.commonjsOptions` | Handle CommonJS dependencies | Set `include: [/socket\.io-client/]` |
| `resolve.dedupe` | Prevent multiple instances | Add `'socket.io-client'` |

**Modification Location**: After line 44 in `vite.config.ts`

Update `optimizeDeps` section:
- Change from: `include: ['react', 'react-dom']`
- Change to: `include: ['react', 'react-dom', 'socket.io-client']`

Add new configuration after `build.emptyOutDir`:
- `commonjsOptions` object with `include` pattern matching socket.io-client

Add new configuration in `resolve` section:
- `dedupe` array containing 'socket.io-client'

### Validation Strategy

#### Build Verification
After configuration changes, the build should:
1. Successfully resolve socket.io-client import
2. Bundle the client-side socket code into production assets
3. Complete without Rollup resolution errors
4. Generate functional production build in `dist/public`

#### Runtime Verification
Once deployed, verify:
1. WebSocket connection establishes successfully
2. Real-time messaging functions work
3. No console errors related to socket.io-client
4. Browser DevTools Network tab shows socket.io connection

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Build still fails after config change | Low | Alternative: try externalizing socket.io-client for server-side handling |
| Runtime socket connection issues | Low | Socket.io has robust fallback mechanisms; dev environment works |
| Increased bundle size | Low | Socket.io-client is already a dependency; just fixing resolution |

## Dependencies

### Affected Components
- `client/src/lib/socket.ts` - WebSocket initialization and management
- Build pipeline (`script/build.ts`) - Executes Vite build
- Production deployment - Nginx serves built assets

### No Code Changes Required
This is purely a build configuration fix. No modifications to socket.ts or other source files are needed.

## Success Criteria

1. Build command `npm run build` completes without errors
2. `dist/public` directory contains bundled client assets including socket logic
3. Production application successfully establishes WebSocket connections
4. Real-time messaging features (messages, reactions, typing indicators) function correctly

## Alternative Solutions (If Primary Solution Fails)

### Option A: External Socket.io-client
Configure Rollup to treat socket.io-client as external and load it from CDN or separate bundle.

### Option B: Dynamic Import
Change socket.ts to use dynamic imports: `const { io } = await import('socket.io-client')`

### Option C: SSR Build Configuration
Add specific SSR handling since socket.io-client is client-only code.

**Recommendation**: Try primary solution first, as it's the cleanest approach with minimal changes.
**Recommendation**: Try primary solution first, as it's the cleanest approach with minimal changes.