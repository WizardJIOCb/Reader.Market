import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Generate a strong secret if not provided
function getSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  
  if (!envSecret || envSecret === 'my_secret_key_for_jwt_tokens' || envSecret === 'default_secret') {
    console.warn('WARNING: Using insecure JWT secret. Please set a strong JWT_SECRET in environment variables.');
    // Generate a strong random secret for development only
    return crypto.randomBytes(64).toString('hex');
  }
  
  return envSecret;
}

/**
 * Generates a JWT token with proper security options
 */
export function generateToken(payload: { userId: string; accessLevel?: string }): string {
  const secret = getSecret();
  return jwt.sign(payload, secret, {
    issuer: 'reader.market',
    audience: 'reader.market-users',
    expiresIn: '7d', // 7 days
    algorithm: 'HS256'
  });
}

/**
 * Verifies a JWT token with proper security options
 */
export async function verifyToken(token: string): Promise<{ userId: string; accessLevel?: string } | null> {
  const secret = getSecret();
  
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'reader.market',
      audience: 'reader.market-users',
      algorithms: ['HS256']
    }) as { userId: string; accessLevel?: string };
    
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Refreshes a token (creates a new token with the same payload)
 */
export function refreshToken(payload: { userId: string; accessLevel?: string }): string {
  return generateToken(payload);
}

/**
 * Gets token payload without verification (for debugging purposes only)
 */
export function decodeToken(token: string): { userId: string; accessLevel?: string } | null {
  try {
    const decoded = jwt.decode(token) as { userId: string; accessLevel?: string } | null;
    return decoded;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

/**
 * Validates token structure before verification
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Check basic JWT format (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  // Check if each part is valid base64
  for (const part of parts) {
    try {
      Buffer.from(part, 'base64').toString('base64');
    } catch {
      return false;
    }
  }
  
  return true;
}