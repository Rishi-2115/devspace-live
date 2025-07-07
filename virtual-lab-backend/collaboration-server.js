const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Import existing backend functionality
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Mock users (same as simple-server.js)
const users = [
  { id: '1', name: 'Demo User', email: 'demo@example.com', password: 'demo123', role: 'student', permissions: ['lab.join', 'lab.create'] },
  { id: '2', name: 'John Doe', email: 'john@example.com', password: 'password123', role: 'student', permissions: ['lab.join', 'lab.create'] }
];

// In-memory file system for each lab (same as simple-server.js)
const fileSystems = new Map();

// Initialize default file system for a lab
function initializeFileSystem(labId) {
  if (!fileSystems.has(labId)) {
    const defaultContent = {
      'main.py': '# Welcome to your Python lab!\nprint("Hello, World!")\n\n# Try running some code!\nfor i in range(5):\n    print(f"Number: {i}")',
      'README.md': '# Virtual Lab\n\nWelcome to your virtual lab environment!\n\nYou can create, edit, and run files here.',
      'app.js': '// JavaScript example\nconsole.log("Hello from JavaScript!");\n\n// Calculate fibonacci\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log("Fibonacci of 10:", fibonacci(10));',
      'hello.cpp': '#include <iostream>\n#include <vector>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    \n    std::vector<int> numbers = {1, 2, 3, 4, 5};\n    for (int num : numbers) {\n        std::cout << "Number: " << num << std::endl;\n    }\n    \n    return 0;\n}'
    };
    
    const fileStructure = Object.entries(defaultContent).map(([filename, content]) => ({
      id: `${labId}_${filename}`,
      name: filename,
      path: filename,
      type: 'file',
      size: content.length,
      extension: path.extname(filename),
      content: content,
      lastModified: new Date().toISOString(),
      permissions: 'rw-r--r--',
      owner: 'user'
    }));
    
    fileSystems.set(labId, fileStructure);
  }
  return fileSystems.get(labId);
}

// Code execution function (same as simple-server.js)
function executeCode(code, language = 'python') {
  return new Promise((resolve, reject) => {
    let cmd, args, fileExtension;
    
    switch (language.toLowerCase()) {
      case 'python':
        cmd = 'python';
        // Properly escape code by writing to temp file instead of using -c
        const tempFileName = `temp_${Date.now()}.py`;
        fs.writeFileSync(tempFileName, code);
        args = [tempFileName];
        fileExtension = '.py';
        
        // Schedule cleanup
        setTimeout(() => {
          if (fs.existsSync(tempFileName)) {
            fs.unlinkSync(tempFileName);
          }
        }, 5000);
        break;
      case 'javascript':
        cmd = 'node';
        args = ['-e', code];
        fileExtension = '.js';
        break;
      case 'cpp':
      case 'c++':
        const cppFileName = `temp_${Date.now()}.cpp`;
        const cppExeFileName = `temp_${Date.now()}.exe`;
        
        fs.writeFileSync(cppFileName, code);
        
        const compileProcess = spawn('g++', ['-o', cppExeFileName, cppFileName]);
        
        compileProcess.on('close', (compileCode) => {
          fs.unlinkSync(cppFileName);
          
          if (compileCode === 0) {
            const runProcess = spawn(`./${cppExeFileName}`, [], { shell: true });
            let output = '';
            let error = '';
            
            runProcess.stdout.on('data', (data) => {
              output += data.toString();
            });
            
            runProcess.stderr.on('data', (data) => {
              error += data.toString();
            });
            
            runProcess.on('close', (code) => {
              if (fs.existsSync(cppExeFileName)) {
                fs.unlinkSync(cppExeFileName);
              }
              resolve({ output: output || error, error: error, exitCode: code });
            });
          } else {
            resolve({ output: '', error: 'Compilation failed', exitCode: compileCode });
          }
        });
        return;
      default:
        reject(new Error(`Unsupported language: ${language}`));
        return;
    }
    
    const child = spawn(cmd, args, { shell: true });
    let output = '';
    let error = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({ output: output || error, error: error, exitCode: code });
    });
    
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        resolve({
          output: '',
          error: `${cmd} command not found. Please install ${language} to execute ${language} code.`,
          exitCode: 127
        });
      } else {
        reject(err);
      }
    });
  });
}

// Store active sessions and collaborators
const activeSessions = new Map();
const collaborators = new Map();

// Collaboration namespace
const collaborationNamespace = io.of('/collaboration');

collaborationNamespace.on('connection', (socket) => {
  console.log('User connected to collaboration:', socket.id);

  // Join a lab session
  socket.on('join-session', (data) => {
    const { sessionId, userId, labId } = data;
    
    socket.join(sessionId);
    
    // Add user to collaborators
    const collaborator = {
      id: userId,
      socketId: socket.id,
      name: `User ${userId}`,
      avatar: `https://ui-avatars.com/api/?name=User+${userId}`,
      color: getRandomColor(),
      joinedAt: new Date().toISOString(),
      isActive: true
    };
    
    if (!collaborators.has(sessionId)) {
      collaborators.set(sessionId, []);
    }
    
    collaborators.get(sessionId).push(collaborator);
    
    // Notify others about new user
    socket.to(sessionId).emit('user-joined', collaborator);
    
    // Send current collaborators to new user
    socket.emit('collaborators-updated', collaborators.get(sessionId));
    
    console.log(`User ${userId} joined session ${sessionId}`);
  });

  // Handle real-time text operations
  socket.on('operation', (operation) => {
    const { sessionId, userId } = operation;
    console.log(`📝 Received operation from user ${userId} in session ${sessionId}:`, operation.content?.substring(0, 50) + '...');
    
    if (sessionId) {
      // Broadcast operation to all other users in the session
      console.log(`📡 Broadcasting operation to session ${sessionId}`);
      socket.to(sessionId).emit('operation', operation);
      console.log(`✅ Operation broadcasted to other users in session ${sessionId}`);
    } else {
      console.log('❌ No sessionId in operation, not broadcasting');
    }
  });

  // Handle cursor position updates
  socket.on('cursor-update', (data) => {
    const { sessionId, userId, line, column } = data;
    if (sessionId) {
      socket.to(sessionId).emit('cursor-update', {
        userId,
        line,
        column
      });
    }
  });

  // Handle file changes
  socket.on('file-change', (data) => {
    const { sessionId, fileId, content, userId } = data;
    if (sessionId) {
      socket.to(sessionId).emit('file-changed', {
        fileId,
        content,
        userId
      });
    }
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const { sessionId, message, userId } = data;
    if (sessionId) {
      const chatMessage = {
        id: Date.now().toString(),
        message,
        userId,
        timestamp: new Date().toISOString(),
        type: 'message'
      };
      
      // Broadcast to all users in session
      collaborationNamespace.to(sessionId).emit('chat-message', chatMessage);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from all sessions
    collaborators.forEach((sessionCollaborators, sessionId) => {
      const index = sessionCollaborators.findIndex(c => c.socketId === socket.id);
      if (index !== -1) {
        const collaborator = sessionCollaborators[index];
        sessionCollaborators.splice(index, 1);
        
        // Notify others about user leaving
        socket.to(sessionId).emit('user-left', collaborator.id);
        socket.to(sessionId).emit('collaborators-updated', sessionCollaborators);
      }
    });
  });

  // Leave session
  socket.on('leave-session', (data) => {
    const { sessionId, userId } = data;
    
    socket.leave(sessionId);
    
    // Remove from collaborators
    if (collaborators.has(sessionId)) {
      const sessionCollaborators = collaborators.get(sessionId);
      const index = sessionCollaborators.findIndex(c => c.id === userId);
      if (index !== -1) {
        sessionCollaborators.splice(index, 1);
        socket.to(sessionId).emit('user-left', userId);
        socket.to(sessionId).emit('collaborators-updated', sessionCollaborators);
      }
    }
  });
});

// Generate random color for user
function getRandomColor() {
  const colors = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'yellow'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Authentication routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = `fake-jwt-token-${user.id}`;
  
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    },
    token
  });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const newUser = {
    id: (users.length + 1).toString(),
    name,
    email,
    password,
    role: 'student',
    permissions: ['lab.join', 'lab.create']
  };
  
  users.push(newUser);
  
  const token = `fake-jwt-token-${newUser.id}`;
  
  res.json({
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      permissions: newUser.permissions
    },
    token
  });
});

// Virtual Lab Management API routes
app.get('/api/virtual-lab/:labId', (req, res) => {
  const { labId } = req.params;
  
  // Return a mock lab instance
  res.json({
    id: labId,
    name: 'Virtual Lab',
    status: 'running',
    image: 'python:3.9',
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    resources: {
      cpu: '1 CPU',
      memory: '512MB',
      storage: '1GB'
    }
  });
});

app.post('/api/virtual-lab/create', (req, res) => {
  const { labId, userId, name, image } = req.body;
  
  // Initialize file system for this lab
  initializeFileSystem(labId);
  
  // Return created lab instance
  res.status(201).json({
    id: labId,
    name: name || 'Virtual Lab',
    status: 'running',
    image: image || 'python:3.9',
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    owner: userId,
    resources: {
      cpu: '1 CPU',
      memory: '512MB',
      storage: '1GB'
    }
  });
});

app.post('/api/virtual-lab/:labId/start', (req, res) => {
  const { labId } = req.params;
  
  res.json({
    id: labId,
    name: 'Virtual Lab',
    status: 'running',
    image: 'python:3.9',
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    resources: {
      cpu: '1 CPU',
      memory: '512MB',
      storage: '1GB'
    }
  });
});

app.post('/api/virtual-lab/:labId/stop', (req, res) => {
  const { labId } = req.params;
  
  res.json({
    id: labId,
    name: 'Virtual Lab',
    status: 'stopped',
    image: 'python:3.9',
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    resources: {
      cpu: '1 CPU',
      memory: '512MB',
      storage: '1GB'
    }
  });
});

app.post('/api/virtual-lab/:labId/restart', (req, res) => {
  const { labId } = req.params;
  
  res.json({
    id: labId,
    name: 'Virtual Lab',
    status: 'running',
    image: 'python:3.9',
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    resources: {
      cpu: '1 CPU',
      memory: '512MB',
      storage: '1GB'
    }
  });
});

app.post('/api/virtual-lab/:labId/snapshot', (req, res) => {
  const { labId } = req.params;
  const { name } = req.body;
  
  res.json({
    message: 'Snapshot created successfully',
    snapshotId: `snapshot_${Date.now()}`,
    name: name || `Snapshot ${new Date().toISOString()}`
  });
});

app.post('/api/virtual-lab/:labId/snapshot/:snapshotId/restore', (req, res) => {
  const { labId, snapshotId } = req.params;
  
  res.json({
    id: labId,
    name: 'Virtual Lab',
    status: 'running',
    image: 'python:3.9',
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    resources: {
      cpu: '1 CPU',
      memory: '512MB',
      storage: '1GB'
    }
  });
});

// File Management API routes
app.get('/api/virtual-lab/:labId/files', (req, res) => {
  const { labId } = req.params;
  
  const fileSystem = initializeFileSystem(labId);
  
  res.json({
    files: fileSystem,
    totalSize: fileSystem.reduce((sum, file) => sum + file.size, 0),
    fileCount: fileSystem.length
  });
});

app.post('/api/virtual-lab/:labId/files', (req, res) => {
  const { labId } = req.params;
  const { name, content = '', type = 'file' } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'File name is required' });
  }
  
  const fileSystem = initializeFileSystem(labId);
  
  const existingFile = fileSystem.find(f => f.name === name);
  if (existingFile) {
    return res.status(409).json({ error: 'File already exists' });
  }
  
  const newFile = {
    name,
    path: name,
    type,
    size: content.length,
    extension: path.extname(name),
    content,
    lastModified: new Date().toISOString(),
    permissions: 'rw-r--r--',
    owner: 'user'
  };
  
  fileSystem.push(newFile);
  
  res.status(201).json({
    message: 'File created successfully',
    file: newFile
  });
});

app.delete('/api/virtual-lab/:labId/files', (req, res) => {
  const { labId } = req.params;
  const { path: filePath, name } = req.body;
  
  // Use path if provided, otherwise fall back to name
  const fileName = filePath || name;
  
  if (!fileName) {
    return res.status(400).json({ error: 'File path or name is required' });
  }
  
  const fileSystem = initializeFileSystem(labId);
  
  const fileIndex = fileSystem.findIndex(f => f.name === fileName || f.path === fileName);
  if (fileIndex === -1) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  fileSystem.splice(fileIndex, 1);
  
  res.json({ message: 'File deleted successfully' });
});

app.post('/api/virtual-lab/:labId/execute', async (req, res) => {
  const { labId } = req.params;
  const { code, language = 'python' } = req.body;
  
  console.log('Executing code:', code);
  console.log('Language:', language);
  
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }
  
  try {
    const startTime = Date.now();
    const result = await executeCode(code, language);
    const executionTime = Date.now() - startTime;
    
    console.log('Execution result:', result);
    
    res.json({
      output: result.output,
      error: result.error,
      exitCode: result.exitCode,
      executionTime,
      language
    });
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({
      error: error.message,
      output: '',
      exitCode: 1
    });
  }
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`🚀 Collaboration server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time collaboration`);
});
