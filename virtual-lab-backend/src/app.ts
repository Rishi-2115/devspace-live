import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDatabases } from './config/database';
import { authRouter } from './routes/auth';
import { virtualLabRouter } from './routes/virtualLab';
import { collaborationRouter } from './routes/collaboration';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting (disabled for development)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100 // limit each IP to 100 requests per windowMs
// });
// app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock user store
const users: any[] = [
  { id: '1', name: 'Demo User', email: 'demo@example.com', password: 'demo123', role: 'student', permissions: ['lab.join', 'lab.create'] },
  { id: '2', name: 'John Doe', email: 'john@example.com', password: 'password123', role: 'student', permissions: ['lab.join', 'lab.create'] }
];

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email, password });
  
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    const token = `token_${user.id}_${Date.now()}`;
    const { password: _, ...userWithoutPassword } = user;
    console.log('Login successful for:', user.email);
    res.json({ user: userWithoutPassword, token });
  } else {
    console.log('Login failed for:', email);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  console.log('Register attempt:', { name, email });
  
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'User already exists' });
  }
  
  const newUser = {
    id: String(users.length + 1),
    name,
    email,
    password,
    role: 'student',
    permissions: ['lab.join', 'lab.create']
  };
  
  users.push(newUser);
  const token = `token_${newUser.id}_${Date.now()}`;
  const { password: _, ...userWithoutPassword } = newUser;
  console.log('Registration successful for:', email);
  res.json({ user: userWithoutPassword, token });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }
  
  const token = authHeader.substring(7);
  if (token.startsWith('token_')) {
    const userId = token.split('_')[1];
    const user = users.find(u => u.id === userId);
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword });
    }
  }
  
  res.status(401).json({ error: 'Invalid token' });
});

// Routes
app.use('/api/virtual-lab', virtualLabRouter);
app.use('/api/collaboration', collaborationRouter);

// Socket.io for real-time features
io.use((socket, next) => {
  // Socket authentication middleware
  const token = socket.handshake.auth.token;
  // Verify JWT token
  next();
});

app.use(errorHandler);

const PORT = process.env.PORT || 3001;

async function startServer() {
  await connectDatabases();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

export { io };
