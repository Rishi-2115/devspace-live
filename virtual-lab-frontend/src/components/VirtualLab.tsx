import React, { useState, useEffect } from 'react';
import { CollaborativeEditor } from './CollaborativeEditor';
import { FileExplorer } from './FileExplorer';
import { ResourceMonitor } from './ResourceMonitor';
import { Terminal } from './Terminal';
import { CollaborationChat } from './CollaborationChat';
import { useVirtualLab } from '../hooks/useVirtualLab';
import { useCollaboration } from '../hooks/useCollaboration';
import { useAuth } from '../contexts/AuthContext';
import { VirtualLabInstance, FileNode } from '../types/virtualLab';
import '../styles/VirtualLab.css';

interface VirtualLabProps {
  labId: string;
  assignmentId?: string;
}

export const VirtualLab: React.FC<VirtualLabProps> = ({ labId, assignmentId }) => {
  const { user, logout } = useAuth();
  const userId = user?.id || '';
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);
  const [layout, setLayout] = useState({
    showFileExplorer: true,
    showTerminal: true,
    showResourceMonitor: true,
    showChat: false,
    editorWidth: 60,
    terminalHeight: 30
  });

  const {
    labInstance,
    isLoading,
    error,
    createLab,
    startLab,
    stopLab,
    restartLab,
    saveSnapshot,
    loadSnapshot,
    createFile,
    deleteFile,
    executeCode
  } = useVirtualLab(labId, userId);

  const {
    collaborators,
    isConnected,
    joinSession,
    leaveSession
  } = useCollaboration(labId, userId);

  useEffect(() => {
    if (!labInstance) {
      createLab({
        name: 'Python Lab',
        image: 'python:3.9'
      });
    }
  }, [labId,assignmentId]);

  useEffect(() => {
    // Always use the consistent labId for collaboration, not labInstance.id
    if (labId) {
      console.log('Joining collaboration session:', labId);
      joinSession(labId);
    }
    
    return () => {
      leaveSession();
    };
  }, [labId, joinSession, leaveSession]);

  const handleFileSelect = (file: FileNode) => {
    // Add some executable content for demonstration
    const fileWithContent = {
      ...file,
      content: file.name.endsWith('.py') ? 
        `# ${file.name}\nprint("Hello from ${file.name}!")\nprint("Python execution is working!")\n\n# Calculate some numbers\nfor i in range(5):\n    print(f"Number: {i}")\n\n# Demonstrate Python features\nimport math\nresult = math.sqrt(16)\nprint(f"Square root of 16 is: {result}")` :
        file.name.endsWith('.js') ?
        `// ${file.name}\nconsole.log("Hello from ${file.name}!");\nconsole.log("JavaScript execution is working!");\n\n// Calculate some numbers\nfor (let i = 0; i < 5; i++) {\n    console.log(\`Number: \${i}\`);\n}\n\n// Demonstrate JavaScript features\nconst result = Math.sqrt(16);\nconsole.log(\`Square root of 16 is: \${result}\`);` :
        `# ${file.name}\n\nThis is a sample file.\nYou can edit this content and run it to see real execution results!`
    };
    setActiveFile(fileWithContent);
  };

  const handleFileCreate = async (path: string, type: 'file' | 'folder') => {
    try {
      if (type === 'file') {
        await createFile(path, '// New file\n');
      } else {
        // For folders, we need to create a folder endpoint or create a placeholder file
        await createFile(`${path}/.gitkeep`, '');
      }
      console.log('Created', type, 'at', path);
    } catch (error) {
      console.error('Failed to create', type, ':', error);
    }
  };

  const handleFileDelete = async (path: string) => {
    try {
      await deleteFile(path);
      console.log('Deleted file at', path);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleCodeChange = (code: string) => {
    if (activeFile) {
      // Update file content
      console.log('Code changed for', activeFile.name);
      setActiveFile(prev => prev ? { ...prev, content: code } : null);
    }
  };

  const handleRunCode = async () => {
    if (activeFile && labInstance) {
      try {
        console.log('Running code for file:', activeFile.name);
        const language = getLanguageFromExtension(activeFile.name);
        const codeToExecute = activeFile.content || '';
        
        console.log('Executing code:', codeToExecute);
        console.log('Language:', language);
        
        const result = await executeCode(codeToExecute, language);
        console.log('Execution result:', result);
      } catch (error) {
        console.error('Error running code:', error);
      }
    }
  };

  const getLanguageFromExtension = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'py': 'python',
      'js': 'javascript', 
      'ts': 'typescript',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust'
    };
    return languageMap[extension || ''] || 'plaintext';
  };

  const handleLayoutChange = (newLayout: Partial<typeof layout>) => {
    setLayout(prev => ({ ...prev, ...newLayout }));
  };
 const handleSaveSnapshot = () => { // Fix: remove parameter
    saveSnapshot();
  };
  if (isLoading) {
    return (
      <div className="virtual-lab-loading">
        <div className="loading-spinner"></div>
        <p>Setting up your virtual lab...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="virtual-lab-error">
        <h3>Error loading virtual lab</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="virtual-lab">
      <div className="virtual-lab-header">
        <div className="lab-info">
          <h2>{labInstance?.name || 'Virtual Lab'}</h2>
          <div className="lab-status">
            <span className={`status-indicator ${labInstance?.status}`}>
              {labInstance?.status}
            </span>
            {isConnected && (
              <span className="connection-status connected">
                Connected ({collaborators.length} users)
              </span>
            )}
          </div>
          <div className="user-info">
            <span className="welcome-text">Welcome, {user?.name}</span>
            <button 
              onClick={logout}
              className="btn btn-outline logout-btn"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>
        
        <div className="lab-controls">
          <button 
            onClick={startLab} 
            disabled={labInstance?.status === 'running'}
            className="btn btn-success"
          >
            Start
          </button>
          <button 
            onClick={stopLab} 
            disabled={labInstance?.status === 'stopped'}
            className="btn btn-danger"
          >
            Stop
          </button>
          <button 
            onClick={restartLab}
            className="btn btn-warning"
          >
            Restart
          </button>
           <button
        onClick={handleSaveSnapshot} // Fix: use wrapper function
        className="btn btn-primary"
      >
        Save Snapshot
      </button>
        </div>
      </div>

      <div className="virtual-lab-body">
        <div className="lab-sidebar" style={{ display: layout.showFileExplorer ? 'block' : 'none' }}>
          <FileExplorer
            labId={labId}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
            activeFile={activeFile}
          />
        </div>

        <div className="lab-main" style={{ width: `${layout.editorWidth}%` }}>
          <div className="editor-container">
            <CollaborativeEditor
              file={activeFile as any}
              labId={labId}
              userId={userId}
              onChange={handleCodeChange}
              onRun={handleRunCode}
              collaborators={collaborators}
            />
          </div>

          {layout.showTerminal && (
            <div className="terminal-container" style={{ height: `${layout.terminalHeight}%` }}>
              <Terminal
                labId={labId}
                isActive={labInstance?.status === 'running'}
              />
            </div>
          )}
        </div>

        {layout.showResourceMonitor && (
          <div className="lab-sidebar-right">
            <ResourceMonitor
              labId={labId}
              instance={labInstance}
            />
          </div>
        )}
      </div>

      <div className="virtual-lab-footer">
        <div className="layout-controls">
          <button 
            onClick={() => handleLayoutChange({ showFileExplorer: !layout.showFileExplorer })}
            className={`btn btn-sm ${layout.showFileExplorer ? 'active' : ''}`}
          >
            Files
          </button>
          <button 
            onClick={() => handleLayoutChange({ showTerminal: !layout.showTerminal })}
            className={`btn btn-sm ${layout.showTerminal ? 'active' : ''}`}
          >
            Terminal
          </button>
          <button 
            onClick={() => handleLayoutChange({ showResourceMonitor: !layout.showResourceMonitor })}
            className={`btn btn-sm ${layout.showResourceMonitor ? 'active' : ''}`}
          >
            Resources
          </button>
        </div>
        
        <div className="collaborators-list">
          {collaborators.map(collaborator => (
            <div key={collaborator.id} className="collaborator-avatar">
              <img src={collaborator.avatar} alt={collaborator.name} />
              <span className="collaborator-name">{collaborator.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Collaboration Chat */}
      <CollaborationChat
        labId={labId}
        collaborators={collaborators}
        isVisible={layout.showChat}
        onToggle={() => handleLayoutChange({ showChat: !layout.showChat })}
      />
    </div>
  );
}
