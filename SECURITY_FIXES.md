# Security Fixes Required

## Critical: JWT Secret Vulnerability

### Current Issues:
1. Using `process.env.JWT_SECRET || "default_secret"` in multiple files
2. Default secret in `.env` file is weak: `my_secret_key_for_jwt_tokens`
3. Multiple locations with hardcoded fallback secrets

### Files Affected:
- `server/routes.ts` (lines 244, 272, 312, 379, 7300)
- `server/routes/tts.routes.ts` (line 31)
- `server/routes/loggingConfig.ts` (line 31)
- `server/routes/bookTranslations.ts` (line 230)

### Immediate Fix Steps:

1. **Generate Strong Secret:**
```bash
# On server, run:
openssl rand -hex 64
# Or in PowerShell:
$bytes = New-Object byte[] 64; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

2. **Update .env file:**
```diff
- JWT_SECRET=my_secret_key_for_jwt_tokens
+ JWT_SECRET=YOUR_GENERATED_STRONG_SECRET_HERE
```

3. **Restart server:**
```bash
# Stop current server
./stop-dev.bat

# Start with new configuration
./start-dev.bat
```

### Better Long-term Solution:
Replace direct JWT operations with the secure utilities in `server/utils/jwt-utils.ts` which already have proper validation and warning systems.

The `jwt-utils.ts` file already implements:
- Strong secret generation when env var is missing/weak
- Proper JWT signing options (issuer, audience, algorithm)
- Better error handling
- Warning system for insecure configurations