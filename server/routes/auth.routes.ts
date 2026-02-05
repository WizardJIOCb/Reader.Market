import { Router, type Express } from 'express';
import bcrypt from 'bcrypt';
import { generateToken, verifyToken } from '../utils/jwt-utils';
import { storage } from '../storage';
import { db } from '../storage/db';
import { users, oauthStates } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export function createAuthRouter() {
  const router = Router();

// Registration endpoint
router.post("/register", async (req, res) => {
  try {
    const { username, password, email, fullName, language = 'en' } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        username,
        password: hashedPassword,
        email: email || null,
        fullName: fullName || null,
        language: language,
        accessLevel: 'user'
      })
      .returning();

    // Generate token
    const token = generateToken({ 
      userId: newUser[0].id, 
      accessLevel: newUser[0].accessLevel || undefined 
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser[0].id,
        username: newUser[0].username,
        email: newUser[0].email,
        fullName: newUser[0].fullName,
        language: newUser[0].language,
        accessLevel: newUser[0].accessLevel
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(and(eq(users.username, username)))
      .limit(1);

    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user[0].password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user[0].id));

    // Generate token
    const token = generateToken({ 
      userId: user[0].id, 
      accessLevel: user[0].accessLevel || undefined 
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user[0].id,
        username: user[0].username,
        email: user[0].email,
        fullName: user[0].fullName,
        language: user[0].language,
        accessLevel: user[0].accessLevel
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

  return router;
}