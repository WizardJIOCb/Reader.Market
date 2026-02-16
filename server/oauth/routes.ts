import { Router, Express } from 'express';
import passport from 'passport';
import { createState, validateAndConsumeState, generateCodeVerifier, generateCodeChallenge } from './stateManager';
import { oauthService } from './OAuthService';
import { getVKAuthUrl, exchangeVKCode, getVKUserInfo } from './providers/vkOAuth';
import { getYandexAuthUrl, exchangeYandexCode, getYandexUserInfo } from './providers/yandexOAuth';
import { verifyTelegramAuth, getTelegramUserInfo } from './providers/telegramAuth';
import { setupGoogleStrategy } from './strategies/googleStrategy';
import { setupDiscordStrategy } from './strategies/discordStrategy';
import { setupTwitterStrategy } from './strategies/twitterStrategy';
import { storage } from '../storage';
import { generateToken } from '../utils/jwt-utils';
import type { OAuthProvider } from '../config/oauth';
import type { Request, Response } from 'express';

// Initialize Passport strategies
setupGoogleStrategy();
setupDiscordStrategy();
setupTwitterStrategy();

// Helper to create registration activity and broadcast via WebSocket
async function createRegistrationActivity(app: Express, user: any) {
  try {
    console.log('[OAuth Registration] Creating user action for registration event');
    const action = await storage.createUserAction({
      userId: user.id,
      actionType: 'user_registered',
      targetType: 'user',
      targetId: user.id,
      metadata: { username: user.username }
    });
    console.log('[OAuth Registration] User action created:', action?.id);
    
    // Broadcast registration event via WebSocket
    if ((app as any).io && action) {
      const io = (app as any).io;
      console.log('[OAuth Registration] Broadcasting registration event to stream:global');
      
      const eventData = {
        id: action.id,
        type: 'user_action',
        action_type: 'user_registered',
        entityId: action.id,
        userId: user.id,
        user: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatarUrl || null
        },
        target: {
          type: 'user',
          id: user.id,
          username: user.username,
          avatar_url: user.avatarUrl || null
        },
        metadata: { username: user.username },
        createdAt: action.createdAt,
        timestamp: action.createdAt.toISOString()
      };
      
      // Broadcast to both global stream and last-actions room
      io.to('stream:global').emit('stream:last-action', eventData);
      io.to('last-actions').emit('last-action', eventData);
      console.log('[OAuth Registration] ✅ Registration event broadcasted');
    }
  } catch (error) {
    console.error('[OAuth Registration] Failed to create registration activity:', error);
    // Don't fail the OAuth flow if activity creation fails
  }
}

export function createOAuthRoutes(app: Express) {
  const router = Router();

// Google OAuth
router.get('/auth/google', async (req: Request, res: Response) => {
  // Get user's selected language from query parameter or cookie
  const language = req.query.lang as string || req.cookies?.i18nextLng || 'en';
  const state = await createState('google', undefined, language);
  passport.authenticate('google', { state, session: false })(req, res);
});

router.get('/auth/callback/google', async (req: Request, res: Response) => {
  const { state } = req.query;

  const stateResult = await validateAndConsumeState(state as string, 'google');
  if (!state || typeof state !== 'string' || !stateResult.valid) {
    return res.redirect('/login?error=invalid_state');
  }

  passport.authenticate('google', { session: false }, async (err: any, authData: any) => {
    if (err || !authData) {
      return res.redirect('/login?error=oauth_failed');
    }

    try {
      const email = authData.profile.emails?.[0]?.value;
      const avatarUrl = authData.profile.photos?.[0]?.value;
      const { user, isNewUser } = await oauthService.handleOAuthCallback({
        provider: 'google',
        providerUserId: authData.profile.id,
        email,
        displayName: authData.profile.displayName,
        avatarUrl,
        language: stateResult.language || 'en',
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });

      if (!user) {
        return res.redirect('/login?error=oauth_failed');
      }

      // Create registration activity for new users
      if (isNewUser) {
        await createRegistrationActivity(app, user);
      }

      const token = generateToken({ userId: user.id });
      res.redirect(`/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Google OAuth error:', error);
      res.redirect('/login?error=oauth_failed');
    }
  })(req, res);
});

// Discord OAuth
router.get('/auth/discord', async (req: Request, res: Response) => {
  const state = await createState('discord');
  passport.authenticate('discord', { state, session: false })(req, res);
});

router.get('/auth/callback/discord', async (req: Request, res: Response) => {
  const { state } = req.query;

  const stateResult = await validateAndConsumeState(state as string, 'discord');
  if (!state || typeof state !== 'string' || !stateResult.valid) {
    return res.redirect('/login?error=invalid_state');
  }

  passport.authenticate('discord', { session: false }, async (err: any, authData: any) => {
    if (err || !authData) {
      return res.redirect('/login?error=oauth_failed');
    }

    try {
      const { user, isNewUser } = await oauthService.handleOAuthCallback({
        provider: 'discord',
        providerUserId: authData.profile.id,
        email: authData.profile.email,
        displayName: authData.profile.username,
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });

      if (!user) {
        return res.redirect('/login?error=oauth_failed');
      }

      // Create registration activity for new users
      if (isNewUser) {
        await createRegistrationActivity(app, user);
      }

      const token = generateToken({ userId: user.id });
      res.redirect(`/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Discord OAuth error:', error);
      res.redirect('/login?error=oauth_failed');
    }
  })(req, res);
});

// Twitter OAuth
router.get('/auth/twitter', async (req: Request, res: Response) => {
  const state = await createState('twitter');
  passport.authenticate('twitter', { state, session: false })(req, res);
});

router.get('/auth/callback/twitter', async (req: Request, res: Response) => {
  const { state } = req.query;

  const stateResult = await validateAndConsumeState(state as string, 'twitter');
  if (!state || typeof state !== 'string' || !stateResult.valid) {
    return res.redirect('/login?error=invalid_state');
  }

  passport.authenticate('twitter', { session: false }, async (err: any, authData: any) => {
    if (err || !authData) {
      return res.redirect('/login?error=oauth_failed');
    }

    try {
      const email = authData.profile.emails?.[0]?.value;
      const { user, isNewUser } = await oauthService.handleOAuthCallback({
        provider: 'twitter',
        providerUserId: authData.profile.id,
        email,
        displayName: authData.profile.displayName,
        accessToken: authData.accessToken,
      });

      if (!user) {
        return res.redirect('/login?error=oauth_failed');
      }

      // Create registration activity for new users
      if (isNewUser) {
        await createRegistrationActivity(app, user);
      }

      const token = generateToken({ userId: user.id });
      res.redirect(`/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Twitter OAuth error:', error);
      res.redirect('/login?error=oauth_failed');
    }
  })(req, res);
});

// VK OAuth (with PKCE - required by VK ID)
router.get('/auth/vk', async (req: Request, res: Response) => {
  try {
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    // Get user's selected language from query parameter or cookie
    const language = req.query.lang as string || req.cookies?.i18nextLng || 'en';
    
    // Store code verifier and language with state for later use
    const state = await createState('vk', codeVerifier, language);
    const authUrl = await getVKAuthUrl(state, codeChallenge);
    res.redirect(authUrl);
  } catch (error) {
    console.error('VK OAuth initiation error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

router.get('/auth/callback/vk', async (req: Request, res: Response) => {
  const { code, state, device_id } = req.query;

  const stateResult = await validateAndConsumeState(state as string, 'vk');
  if (!state || typeof state !== 'string' || !stateResult.valid) {
    return res.redirect('/login?error=invalid_state');
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/login?error=oauth_failed');
  }

  // PKCE code_verifier is required for VK ID
  if (!stateResult.codeVerifier) {
    console.error('VK OAuth error: missing code_verifier');
    return res.redirect('/login?error=oauth_failed');
  }

  // device_id is returned by VK ID in callback and required for token exchange
  if (!device_id || typeof device_id !== 'string') {
    console.error('VK OAuth error: missing device_id from callback');
    return res.redirect('/login?error=oauth_failed');
  }

  try {
    const tokenData = await exchangeVKCode(code, stateResult.codeVerifier, state, device_id);
    console.log('VK token response:', JSON.stringify(tokenData, null, 2));
    
    const userInfo = await getVKUserInfo(tokenData.access_token);
    console.log('VK user info:', JSON.stringify(userInfo, null, 2));

    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    
    // VK ID user_info response may have user object wrapper
    const userData = (userInfo as any).user || userInfo;
    const userId = userData.user_id || tokenData.user_id;
    
    if (!userId) {
      console.error('VK OAuth error: No user_id found in response');
      return res.redirect('/login?error=oauth_failed');
    }

    const { user, isNewUser } = await oauthService.handleOAuthCallback({
      provider: 'vk',
      providerUserId: userId.toString(),
      email: userData.email || tokenData.email,
      displayName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'VK User',
      avatarUrl: userData.avatar,
      language: stateResult.language || 'en',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt,
    });

    if (!user) {
      return res.redirect('/login?error=oauth_failed');
    }

    // Create registration activity for new users
    if (isNewUser) {
      await createRegistrationActivity(app, user);
    }

    const token = generateToken({ userId: user.id });
    res.redirect(`/auth/callback?token=${token}`);
  } catch (error) {
    console.error('VK OAuth error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

// Yandex OAuth
router.get('/auth/yandex', async (req: Request, res: Response) => {
  try {
    const state = await createState('yandex');
    const authUrl = await getYandexAuthUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Yandex OAuth initiation error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

router.get('/auth/callback/yandex', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  const stateResult = await validateAndConsumeState(state as string, 'yandex');
  if (!state || typeof state !== 'string' || !stateResult.valid) {
    return res.redirect('/login?error=invalid_state');
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/login?error=oauth_failed');
  }

  try {
    const tokenData = await exchangeYandexCode(code);
    const userInfo = await getYandexUserInfo(tokenData.access_token);

    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const { user, isNewUser } = await oauthService.handleOAuthCallback({
      provider: 'yandex',
      providerUserId: userInfo.id,
      email: userInfo.default_email,
      displayName: userInfo.display_name,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt,
    });

    if (!user) {
      return res.redirect('/login?error=oauth_failed');
    }

    // Create registration activity for new users
    if (isNewUser) {
      await createRegistrationActivity(app, user);
    }

    const token = generateToken({ userId: user.id });
    res.redirect(`/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Yandex OAuth error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

// Telegram Login Widget
router.post('/auth/telegram', async (req: Request, res: Response) => {
  try {
    const authData = req.body;

    if (!verifyTelegramAuth(authData)) {
      return res.status(400).json({ error: 'Invalid Telegram authentication data' });
    }

    const userInfo = getTelegramUserInfo(authData);

    const { user, isNewUser } = await oauthService.handleOAuthCallback({
      provider: 'telegram',
      providerUserId: userInfo.id,
      displayName: `${userInfo.firstName} ${userInfo.lastName || ''}`.trim(),
      accessToken: authData.hash,
    });

    if (!user) {
      return res.status(400).json({ error: 'Authentication failed' });
    }

    // Create registration activity for new users
    if (isNewUser) {
      await createRegistrationActivity(app, user);
    }

    const token = generateToken({ userId: user.id });
    res.json({ token });
  } catch (error) {
    console.error('Telegram OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get linked accounts for current user
router.get('/auth/linked-accounts', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const accounts = await oauthService.getLinkedAccounts(userId);
    
    // Return sanitized account info (without tokens)
    const sanitized = accounts.map(acc => ({
      provider: acc.provider,
      email: acc.email,
      createdAt: acc.createdAt,
    }));

    res.json({ accounts: sanitized });
  } catch (error) {
    console.error('Error fetching linked accounts:', error);
    res.status(500).json({ error: 'Failed to fetch linked accounts' });
  }
});

// Unlink OAuth account
router.delete('/auth/unlink/:provider', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const provider = req.params.provider as OAuthProvider;
    const result = await oauthService.unlinkAccount(userId, provider);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error unlinking account:', error);
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

  return router;
}
