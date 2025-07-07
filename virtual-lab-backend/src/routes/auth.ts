import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// Mock user database
const users: any[] = [];
const sessions: any[] = [];

// Helper function to generate JWT-like token (simplified for demo)
const generateToken = (userId: string) => {
  return `token_${userId}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
};

// Helper function to create user object
const createUser = (name: string, email: string, password: string) => {
  const userId = `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  return {
    id: userId,
    name,
    email,
    password, // In production, this should be hashed
    role: 'student' as const,
    permissions: ['lab.join', 'lab.create', 'file.edit'],
    createdAt: new Date().toISOString(),
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff`
  };
};

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Create new user
    const user = createUser(name, email, password);
    users.push(user);

    // Generate token
    const token = generateToken(user.id);
    sessions.push({
      token,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    });

    // Return user (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id);
    sessions.push({
      token,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    });

    // Return user (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user endpoint
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const session = sessions.find(s => s.token === token);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if token is expired
    if (new Date() > new Date(session.expiresAt)) {
      return res.status(401).json({ error: 'Token expired' });
    }

    const user = users.find(u => u.id === session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const oldToken = authHeader.substring(7);
    const session = sessions.find(s => s.token === oldToken);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Remove old session
    const sessionIndex = sessions.findIndex(s => s.token === oldToken);
    if (sessionIndex > -1) {
      sessions.splice(sessionIndex, 1);
    }

    // Generate new token
    const newToken = generateToken(session.userId);
    sessions.push({
      token: newToken,
      userId: session.userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    });

    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const sessionIndex = sessions.findIndex(s => s.token === token);
      if (sessionIndex > -1) {
        sessions.splice(sessionIndex, 1);
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Create some demo users
const demoUsers = [
  createUser('John Doe', 'john@example.com', 'password123'),
  createUser('Jane Smith', 'jane@example.com', 'password123'),
  createUser('Bob Johnson', 'bob@example.com', 'password123')
];

users.push(...demoUsers);

export { router as authRouter };
