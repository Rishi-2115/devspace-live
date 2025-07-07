import { Router } from 'express';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// In-memory file system for development (per lab)
const labFileSystems: { [labId: string]: any[] } = {};

const router = Router();

// Create a new virtual lab
router.post('/create', async (req, res) => {
  try {
    const { labId, userId, name, image } = req.body;
    
    // Mock virtual lab instance
    const labInstance = {
      id: labId,
      name: name || 'Virtual Lab',
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
    };
    
    res.json(labInstance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create virtual lab' });
  }
});

// Get virtual lab by ID
router.get('/:labId', async (req, res) => {
  try {
    const { labId } = req.params;
    
    // Mock lab instance with full properties
    const labInstance = {
      id: labId,
      name: 'Python Virtual Lab',
      description: 'Development environment for Python programming',
      status: 'running',
      containerId: `container-${labId}`,
      imageId: 'python:3.9',
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
    };
    
    res.json(labInstance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get virtual lab' });
  }
});

// Start virtual lab
router.post('/:labId/start', async (req, res) => {
  try {
    const { labId } = req.params;
    console.log(`Starting lab: ${labId}`);
    
    res.json({ message: 'Lab started successfully', status: 'running' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start virtual lab' });
  }
});

// Stop virtual lab
router.post('/:labId/stop', async (req, res) => {
  try {
    const { labId } = req.params;
    console.log(`Stopping lab: ${labId}`);
    
    res.json({ message: 'Lab stopped successfully', status: 'stopped' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop virtual lab' });
  }
});

// Get file tree
router.get('/:labId/files', async (req, res) => {
  try {
    const { labId } = req.params;
    
    // Initialize lab file system if it doesn't exist
    if (!labFileSystems[labId]) {
      labFileSystems[labId] = [
        {
          name: 'main.py',
          path: 'main.py',
          type: 'file',
          size: 1024,
          extension: '.py',
          lastModified: new Date().toISOString(),
          permissions: 'rw-r--r--',
          owner: 'user'
        },
        {
          name: 'src',
          path: 'src',
          type: 'folder',
          children: [
            {
              name: 'app.py',
              path: 'src/app.py',
              type: 'file',
              size: 512,
              extension: '.py',
              lastModified: new Date().toISOString(),
              permissions: 'rw-r--r--',
              owner: 'user'
            }
          ],
          permissions: 'rwxr-xr-x',
          owner: 'user'
        },
        {
          name: 'README.md',
          path: 'README.md',
          type: 'file',
          size: 256,
          extension: '.md',
          lastModified: new Date().toISOString(),
          permissions: 'rw-r--r--',
          owner: 'user'
        }
      ];
    }
    
    res.json(labFileSystems[labId]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get file tree' });
  }
});

// Create file
router.post('/:labId/files', async (req, res) => {
  try {
    const { labId } = req.params;
    const { path, content = '' } = req.body;
    
    console.log(`Creating file ${path} in lab ${labId}`);
    
    // Initialize lab file system if it doesn't exist
    if (!labFileSystems[labId]) {
      labFileSystems[labId] = [];
    }
    
    // Extract file name and extension
    const fileName = path.split('/').pop() || path;
    const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
    
    // Create new file object
    const newFile = {
      name: fileName,
      path: path,
      type: 'file' as const,
      size: content.length,
      extension: extension,
      lastModified: new Date().toISOString(),
      permissions: 'rw-r--r--',
      owner: 'user'
    };
    
    // Add file to the file system
    labFileSystems[labId].push(newFile);
    
    res.json({ message: 'File created successfully', file: newFile });
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: 'Failed to create file' });
  }
});

// Update file
router.put('/:labId/files', async (req, res) => {
  try {
    const { labId } = req.params;
    const { path, content } = req.body;
    
    console.log(`Updating file ${path} in lab ${labId}`);
    
    res.json({ message: 'File updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// Delete file
router.delete('/:labId/files', async (req, res) => {
  try {
    const { labId } = req.params;
    const { path } = req.body;
    
    console.log(`Deleting file ${path} in lab ${labId}`);
    
    // Initialize lab file system if it doesn't exist
    if (!labFileSystems[labId]) {
      labFileSystems[labId] = [];
    }
    
    // Remove file from the file system
    const initialLength = labFileSystems[labId].length;
    labFileSystems[labId] = labFileSystems[labId].filter(file => file.path !== path);
    
    const deleted = labFileSystems[labId].length < initialLength;
    
    if (deleted) {
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Execute code
router.post('/:labId/execute', async (req, res) => {
  try {
    const { labId } = req.params;
    const { code, language } = req.body;
    
    console.log(`Executing ${language} code in lab ${labId}:`, code);
    
    const startTime = Date.now();
    
    if (language === 'python') {
      // Create a temporary file for the Python code
      const tempDir = path.join(process.cwd(), 'temp');
      const tempFile = path.join(tempDir, `${labId}_${Date.now()}.py`);
      
      try {
        // Ensure temp directory exists
        await fs.mkdir(tempDir, { recursive: true });
        
        // Write code to temporary file
        await fs.writeFile(tempFile, code, 'utf8');
        
        // Execute Python code
        exec(`python "${tempFile}"`, { timeout: 10000 }, async (error, stdout, stderr) => {
          const executionTime = Date.now() - startTime;
          
          // Clean up temporary file
          try {
            await fs.unlink(tempFile);
          } catch (cleanupError) {
            console.error('Failed to cleanup temp file:', cleanupError);
          }
          
          if (error) {
            const result = {
              output: stderr || error.message,
              error: stderr || error.message,
              exitCode: error.code || 1,
              executionTime,
              language,
              timestamp: new Date().toISOString()
            };
            res.json(result);
          } else {
            const result = {
              output: stdout || 'Code executed successfully (no output)',
              exitCode: 0,
              executionTime,
              language,
              timestamp: new Date().toISOString()
            };
            res.json(result);
          }
        });
      } catch (fileError: any) {
        res.status(500).json({ 
          error: 'Failed to create temporary file for execution',
          details: fileError.message || 'Unknown error'
        });
      }
    } else if (language === 'javascript') {
      // Execute JavaScript code using Node.js
      const tempDir = path.join(process.cwd(), 'temp');
      const tempFile = path.join(tempDir, `${labId}_${Date.now()}.js`);
      
      try {
        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(tempFile, code, 'utf8');
        
        exec(`node "${tempFile}"`, { timeout: 10000 }, async (error, stdout, stderr) => {
          const executionTime = Date.now() - startTime;
          
          try {
            await fs.unlink(tempFile);
          } catch (cleanupError) {
            console.error('Failed to cleanup temp file:', cleanupError);
          }
          
          if (error) {
            const result = {
              output: stderr || error.message,
              error: stderr || error.message,
              exitCode: error.code || 1,
              executionTime,
              language,
              timestamp: new Date().toISOString()
            };
            res.json(result);
          } else {
            const result = {
              output: stdout || 'Code executed successfully (no output)',
              exitCode: 0,
              executionTime,
              language,
              timestamp: new Date().toISOString()
            };
            res.json(result);
          }
        });
      } catch (fileError: any) {
        res.status(500).json({ 
          error: 'Failed to create temporary file for execution',
          details: fileError.message || 'Unknown error'
        });
      }
    } else {
      // Unsupported language
      const result = {
        output: `Language '${language}' is not supported yet. Supported languages: python, javascript`,
        error: `Unsupported language: ${language}`,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        language,
        timestamp: new Date().toISOString()
      };
      res.json(result);
    }
  } catch (error: any) {
    console.error('Execution error:', error);
    res.status(500).json({ error: 'Failed to execute code', details: error.message || 'Unknown error' });
  }
});

export { router as virtualLabRouter };
