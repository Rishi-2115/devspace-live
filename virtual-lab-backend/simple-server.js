const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Mock users
const users = [
  { id: '1', name: 'Demo User', email: 'demo@example.com', password: 'demo123', role: 'student', permissions: ['lab.join', 'lab.create'] },
  { id: '2', name: 'John Doe', email: 'john@example.com', password: 'password123', role: 'student', permissions: ['lab.join', 'lab.create'] }
];

// In-memory file system for each lab
const fileSystems = new Map();

// Initialize default file system for a lab
function initializeFileSystem(labId) {
  if (!fileSystems.has(labId)) {
    const defaultContent = {
      'main.py': '# Welcome to your Python lab!\nprint("Hello, World!")\n\n# Try running some code!\nfor i in range(5):\n    print(f"Number: {i}")',
      'README.md': '# Virtual Lab\n\nWelcome to your virtual lab environment!\n\nYou can create, edit, and run files here.'
    };
    
    fileSystems.set(labId, [
      { 
        name: 'main.py', 
        path: 'main.py', 
        type: 'file', 
        size: defaultContent['main.py'].length, 
        extension: '.py',
        content: defaultContent['main.py'],
        lastModified: new Date().toISOString(),
        permissions: 'rw-r--r--',
        owner: 'user'
      },
      { 
        name: 'README.md', 
        path: 'README.md', 
        type: 'file', 
        size: defaultContent['README.md'].length, 
        extension: '.md',
        content: defaultContent['README.md'],
        lastModified: new Date().toISOString(),
        permissions: 'rw-r--r--',
        owner: 'user'
      }
    ]);
  }
  return fileSystems.get(labId);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

// Virtual lab mock routes (basic)
app.post('/api/virtual-lab/create', (req, res) => {
  const { labId, userId, name, image } = req.body;
  console.log('Creating lab:', { labId, userId, name, image });
  
  res.json({
    id: labId || 'demo-lab-1',
    name: name || 'Python Virtual Lab',
    description: 'Development environment',
    status: 'running',
    containerId: `container-${labId}`,
    imageId: image || 'python:3.9',
    ports: [{ containerPort: 8080, hostPort: 3000, protocol: 'tcp' }],
    volumes: [],
    environment: {},
    resources: {
      memory: '1g',
      cpu: '1.0',
      disk: '10g'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    ownerId: userId,
    collaborators: [],
    settings: {
      autoSave: true,
      autoSaveInterval: 5,
      collaborationEnabled: true,
      maxCollaborators: 10,
      publicAccess: false,
      allowFileUpload: true,
      allowTerminalAccess: true,
      allowNetworkAccess: true,
      timeoutMinutes: 60,
      snapshotRetention: 7
    }
  });
});

app.get('/api/virtual-lab/:labId', (req, res) => {
  res.json({
    id: req.params.labId,
    name: 'Python Virtual Lab',
    status: 'running',
    imageId: 'python:3.9',
    ports: [],
    volumes: [],
    environment: {},
    resources: { memory: '1g', cpu: '1.0', disk: '10g' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerId: 'user-1',
    collaborators: [],
    settings: {
      autoSave: true,
      autoSaveInterval: 5,
      collaborationEnabled: true,
      maxCollaborators: 10,
      publicAccess: false,
      allowFileUpload: true,
      allowTerminalAccess: true,
      allowNetworkAccess: true,
      timeoutMinutes: 60,
      snapshotRetention: 7
    }
  });
});

app.get('/api/virtual-lab/:labId/files', (req, res) => {
  const labId = req.params.labId;
  const fileSystem = initializeFileSystem(labId);
  console.log('Getting files for lab:', labId, 'Files:', fileSystem);
  res.json(fileSystem);
});

app.post('/api/virtual-lab/:labId/files', (req, res) => {
  const { path, content = '' } = req.body;
  const labId = req.params.labId;
  
  console.log('Creating file:', { labId, path, content });
  
  // Get or initialize file system for this lab
  const fileSystem = initializeFileSystem(labId);
  
  // Extract file name and extension
  const fileName = path.split('/').pop() || path;
  const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
  
  // Check if file already exists
  const existingIndex = fileSystem.findIndex(f => f.path === path);
  
  // Create new file object
  const newFile = {
    name: fileName,
    path: path,
    type: 'file',
    size: content.length,
    extension: extension,
    content: content,
    lastModified: new Date().toISOString(),
    permissions: 'rw-r--r--',
    owner: 'user'
  };
  
  if (existingIndex >= 0) {
    // Update existing file
    fileSystem[existingIndex] = newFile;
  } else {
    // Add new file
    fileSystem.push(newFile);
  }
  
  console.log('File created successfully:', newFile);
  res.json({ message: 'File created successfully', file: newFile });
});

app.delete('/api/virtual-lab/:labId/files', (req, res) => {
  const { path } = req.body;
  const labId = req.params.labId;
  
  console.log('Deleting file:', { labId, path });
  
  // Get file system for this lab
  const fileSystem = initializeFileSystem(labId);
  
  // Find and remove the file
  const fileIndex = fileSystem.findIndex(f => f.path === path);
  if (fileIndex >= 0) {
    fileSystem.splice(fileIndex, 1);
    console.log('File deleted successfully:', path);
    res.json({ message: 'File deleted successfully' });
  } else {
    console.log('File not found:', path);
    res.status(404).json({ error: 'File not found' });
  }
});

// Code execution endpoint
app.post('/api/virtual-lab/:labId/execute', (req, res) => {
  const { code, language } = req.body;
  console.log(`Executing ${language} code:`, code);
  
  // Mock code execution - simulate Python output based on actual code
  if (language === 'python') {
    let output = '';
    
    // Handle all print statements
    const printMatches = code.match(/print\s*\(\s*["']([^"']+)["']\s*\)/g);
    if (printMatches) {
      printMatches.forEach(match => {
        const content = match.match(/print\s*\(\s*["']([^"']+)["']\s*\)/)[1];
        output += content + '\n';
      });
    }
    
    // Handle print with f-strings
    const fStringMatches = code.match(/print\s*\(\s*f["']([^"']+)["']\s*\)/g);
    if (fStringMatches) {
      fStringMatches.forEach(match => {
        const content = match.match(/print\s*\(\s*f["']([^"']+)["']\s*\)/)[1];
        // Simple f-string handling - replace {variable} with placeholder
        const processed = content.replace(/\{(\w+)\}/g, (match, variable) => {
          return variable; // Simple placeholder
        });
        output += processed + '\n';
      });
    }
    
    // Handle the range loop
    const rangeMatch = code.match(/for i in range\((\d+)\):/);
    if (rangeMatch) {
      const maxRange = parseInt(rangeMatch[1]);
      for (let i = 0; i < maxRange; i++) {
        output += `Number: ${i}\n`;
      }
    }
    
    // Handle sqrt calculation
    const sqrtMatch = code.match(/math\.sqrt\((\d+)\)/);
    if (sqrtMatch) {
      const num = parseInt(sqrtMatch[1]);
      const result = Math.sqrt(num);
      output += `Square root of ${num} is: ${result}\n`;
    }
    
    setTimeout(() => {
      res.json({
        output: output,
        exitCode: 0,
        executionTime: 150,
        language: 'python',
        timestamp: new Date().toISOString()
      });
    }, 500); // Simulate execution delay
  } else if (language === 'javascript') {
    let output = '';
    
    // Handle all console.log statements
    const consoleMatches = code.match(/console\.log\s*\(\s*["']([^"']+)["']\s*\)/g);
    if (consoleMatches) {
      consoleMatches.forEach(match => {
        const content = match.match(/console\.log\s*\(\s*["']([^"']+)["']\s*\)/)[1];
        output += content + '\n';
      });
    }
    
    // Handle console.log with template literals
    const templateMatches = code.match(/console\.log\s*\(\s*`([^`]+)`\s*\)/g);
    if (templateMatches) {
      templateMatches.forEach(match => {
        const content = match.match(/console\.log\s*\(\s*`([^`]+)`\s*\)/)[1];
        // Simple template literal handling - replace ${variable} with placeholder
        const processed = content.replace(/\$\{(\w+)\}/g, (match, variable) => {
          return variable; // Simple placeholder
        });
        output += processed + '\n';
      });
    }
    
    // Handle for loops
    const forMatch = code.match(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\w+\s*<\s*(\d+);\s*\w+\+\+\s*\)/);
    if (forMatch) {
      const start = parseInt(forMatch[2]);
      const end = parseInt(forMatch[3]);
      for (let i = start; i < end; i++) {
        output += `Number: ${i}\n`;
      }
    }
    
    // Handle Math.sqrt
    const sqrtMatch = code.match(/Math\.sqrt\s*\(\s*(\d+)\s*\)/);
    if (sqrtMatch) {
      const num = parseInt(sqrtMatch[1]);
      const result = Math.sqrt(num);
      output += `Square root of ${num} is: ${result}\n`;
    }
    
    setTimeout(() => {
      res.json({
        output: output.trim() || 'No output',
        exitCode: 0,
        executionTime: 120,
        language: 'javascript',
        timestamp: new Date().toISOString()
      });
    }, 300);
  } else if (language === 'cpp' || language === 'c') {
    let output = '';
    
    // Parse variables and their values
    const variables = {};
    
    // Extract variable declarations
    const intMatches = code.match(/int\s+(\w+)\s*=\s*(\d+|[^;]+);/g);
    if (intMatches) {
      intMatches.forEach(match => {
        const parts = match.match(/int\s+(\w+)\s*=\s*([^;]+);/);
        if (parts) {
          const varName = parts[1];
          const varValue = parts[2];
          
          // Handle simple arithmetic expressions
          if (varValue.includes('+')) {
            const addParts = varValue.split('+');
            let sum = 0;
            addParts.forEach(part => {
              const trimmed = part.trim();
              if (/^\d+$/.test(trimmed)) {
                sum += parseInt(trimmed);
              } else if (variables[trimmed]) {
                sum += variables[trimmed];
              }
            });
            variables[varName] = sum;
          } else if (/^\d+$/.test(varValue)) {
            variables[varName] = parseInt(varValue);
          }
        }
      });
    }
    
    // Parse cout statements with mixed strings and variables
    const coutLine = code.match(/cout\s*<<.*?;/g);
    if (coutLine) {
      coutLine.forEach(line => {
        // Split by << to get individual parts
        const parts = line.replace(/cout\s*<<\s*/, '').replace(/;$/, '').split('<<');
        
        parts.forEach(part => {
          const trimmed = part.trim();
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            // String literal
            output += trimmed.slice(1, -1);
          } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
            // Character literal
            output += trimmed.slice(1, -1);
          } else if (trimmed === 'endl') {
            output += '\n';
          } else if (variables[trimmed] !== undefined) {
            // Variable
            output += variables[trimmed];
          } else if (/^\d+$/.test(trimmed)) {
            // Number literal
            output += trimmed;
          }
        });
      });
    }
    
    // Handle printf statements (C)
    const printfMatches = code.match(/printf\s*\(\s*["']([^"']+)["']\s*\)/g);
    if (printfMatches) {
      printfMatches.forEach(match => {
        const content = match.match(/printf\s*\(\s*["']([^"']+)["']\s*\)/)[1];
        // Handle basic printf format specifiers
        const processed = content.replace(/\\n/g, '\n');
        output += processed;
      });
    }
    
    setTimeout(() => {
      res.json({
        output: output.trim() || 'Program executed successfully',
        exitCode: 0,
        executionTime: 200,
        language: language,
        timestamp: new Date().toISOString()
      });
    }, 400);
  } else {
    res.json({
      output: `Language '${language}' is not supported yet. Supported languages: python, javascript, c, cpp`,
      error: `Unsupported language: ${language}`,
      exitCode: 1,
      executionTime: 50,
      language: language,
      timestamp: new Date().toISOString()
    });
  }
});

// Lab control endpoints
app.post('/api/virtual-lab/:labId/start', (req, res) => {
  console.log('Starting lab:', req.params.labId);
  res.json({ message: 'Lab started successfully', status: 'running' });
});

app.post('/api/virtual-lab/:labId/stop', (req, res) => {
  console.log('Stopping lab:', req.params.labId);
  res.json({ message: 'Lab stopped successfully', status: 'stopped' });
});

app.post('/api/virtual-lab/:labId/restart', (req, res) => {
  console.log('Restarting lab:', req.params.labId);
  res.json({ message: 'Lab restarted successfully', status: 'running' });
});

app.post('/api/virtual-lab/:labId/snapshot', (req, res) => {
  console.log('Creating snapshot for lab:', req.params.labId);
  res.json({ success: true, snapshotId: 'snap-' + Date.now() });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Simple server running on port ${PORT}`);
  console.log('Available demo users:');
  console.log('- demo@example.com / demo123');
  console.log('- john@example.com / password123');
});
