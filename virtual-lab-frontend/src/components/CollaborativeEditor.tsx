import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { useWebSocket } from '../hooks/useWebSocket';
import { applyOperation, transformOperation, Operation as OTOperation, fromDiff } from '../utils/operationalTransform';
import { FileNode, Collaborator, EditorOperation } from '../types/collaboration';
import { api } from '../services/api';
import '../styles/CollaborativeEditor.css';

interface CollaborativeEditorProps {
  file: FileNode | null;
  labId: string;
  userId: string;
  onChange: (code: string) => void;
  onRun: () => void;
  collaborators: Collaborator[];
}

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  file,
  labId,
  userId,
  onChange,
  onRun,
  collaborators
}) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [cursors, setCursors] = useState<Map<string, { line: number; column: number }>>(new Map());
  
  const editorRef = useRef<any>(null);
  const operationQueue = useRef<EditorOperation[]>([]);
  const lastOperation = useRef<EditorOperation | null>(null);

  const { socket, isConnected } = useWebSocket(`/collaboration/${labId}`);
  
  useEffect(() => {
    console.log('CollaborativeEditor - WebSocket status:', isConnected, 'LabId:', labId);
  }, [isConnected, labId]);

  useEffect(() => {
    if (file) {
      setCode(file.content || '');
      setLanguage(getLanguageFromExtension(file.name));
    }
  }, [file]);

  useEffect(() => {
    if (!socket) return;

    socket.on('operation', handleRemoteOperation);
    socket.on('cursor-update', handleCursorUpdate);
    socket.on('file-changed', handleFileChanged);
    socket.on('execution-result', handleExecutionResult);

    return () => {
      socket.off('operation', handleRemoteOperation);
      socket.off('cursor-update', handleCursorUpdate);
      socket.off('file-changed', handleFileChanged);
      socket.off('execution-result', handleExecutionResult);
    };
  }, [socket]);

  const handleRemoteOperation = (operation: EditorOperation) => {
    console.log('Received remote operation:', operation);
    
    if (operation.userId === userId) {
      console.log('Ignoring operation from self');
      return;
    }

    console.log('Processing remote operation from user:', operation.userId);

    // For now, simply apply the content directly (simplified approach)
    if (operation.content) {
      console.log('Applying remote content:', operation.content);
      setCode(operation.content);
      onChange(operation.content);
      
      // Update editor content
      if (editorRef.current) {
        editorRef.current.setValue(operation.content);
      }
    }
  };

  const handleCursorUpdate = (data: { userId: string; line: number; column: number }) => {
    if (data.userId !== userId) {
      setCursors(prev => new Map(prev.set(data.userId, { line: data.line, column: data.column })));
    }
  };

  const handleFileChanged = (fileData: { path: string; content: string }) => {
    if (file && file.path === fileData.path) {
      setCode(fileData.content);
    }
  };

  const handleExecutionResult = (result: { output: string; error?: string; exitCode: number; executionTime?: number }) => {
    console.log('Execution result received:', result);
    console.log('Output length:', result.output?.length);
    console.log('Output content:', JSON.stringify(result.output));
    
    let outputText = result.output || '';
    
    // Add execution time if available
    if (result.executionTime) {
      outputText += `\n\n--- Execution completed in ${result.executionTime}ms ---`;
    }
    
    // Add error information if exit code is non-zero
    if (result.exitCode !== 0) {
      outputText += `\n--- Process exited with code ${result.exitCode} ---`;
    }
    
    console.log('Final output text:', JSON.stringify(outputText));
    setOutput(outputText);
    setIsRunning(false);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !file) return;

    const operation: EditorOperation = {
      id: generateOperationId(),
      userId: userId,
      fileId: file.id || file.name,
      type: 'replace',
      position: { line: 0, column: 0 },     
      content: value,
      length: code.length,
      timestamp: Date.now()
    };

    console.log('Sending operation:', operation);

    // Add to operation queue
    operationQueue.current.push(operation);
    lastOperation.current = operation;

    // Send operation to server with session info
    if (socket && isConnected) {
      socket.emit('operation', {
        ...operation,
        sessionId: labId // Use labId as sessionId for consistency
      });
      console.log('Operation sent to WebSocket');
    } else {
      console.log('WebSocket not connected, operation not sent');
    }

    setCode(value);
    onChange(value);

    // Clean up operation queue after acknowledgment
    setTimeout(() => {
      operationQueue.current = operationQueue.current.filter(op => op.id !== operation.id);
    }, 1000);
  };

  const handleCursorPositionChange = (position: { lineNumber: number; column: number }) => {
    if (socket && isConnected) {
      socket.emit('cursor-update', {
        userId,
        line: position.lineNumber,
        column: position.column
      });
    }
  };

  const handleRunCode = async () => {
    if (!file || isRunning) return;

    setIsRunning(true);
    setOutput('Executing code...\n');

    try {
      // Use the api service to include authentication token
      const response = await api.post(`/virtual-lab/${labId}/execute`, {
        code,
        language
      });

      handleExecutionResult(response.data);
    } catch (error: any) {
      console.error('Execution error:', error);
      let errorMessage = 'Failed to execute code';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setOutput(`Error: ${errorMessage}`);
      setIsRunning(false);
    }

    onRun();
  };

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;

    // Add cursor position change listener
    editor.onDidChangeCursorPosition((e: any) => {
      handleCursorPositionChange({
        lineNumber: e.position.lineNumber,
        column: e.position.column
      });
    });

    // Add collaborative cursors decoration
    updateCollaborativeCursors();
  };

  const updateCollaborativeCursors = () => {
    if (!editorRef.current) return;

    const decorations: any[] = [];
    cursors.forEach((position, userId) => {
      const collaborator = collaborators.find(c => c.id === userId);
      if (collaborator) {
        decorations.push({
          range: {
            startLineNumber: position.line,
            startColumn: position.column,
            endLineNumber: position.line,
            endColumn: position.column + 1
          },
          options: {
            className: `cursor-${collaborator.color}`,
            hoverMessage: { value: collaborator.name }
          }
        });
      }
    });

    editorRef.current.deltaDecorations([], decorations);
  };

  const getLanguageFromExtension = (extension: string): string => {
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.xml': 'xml',
      '.sql': 'sql'
    };
    return languageMap[extension] || 'plaintext';
  };

  const generateOperationId = (): string => {
    return `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const convertToOTOperation = (operation: EditorOperation, oldContent: string): OTOperation => {
    return fromDiff(oldContent, operation.content, operation.userId);
  };

  const convertFromOTOperation = (otOp: OTOperation, operation: EditorOperation): EditorOperation => {
    return {
      ...operation,
      id: otOp.id,
      userId: otOp.author
    };
  };

  if (!file) {
    return (
      <div className="collaborative-editor-empty">
        <div className="empty-state">
          <h3>No file selected</h3>
          <p>Select a file from the file explorer to start coding</p>
        </div>
      </div>
    );
  }

  return (
    <div className="collaborative-editor">
      <div className="editor-header">
        <div className="file-info">
          <span className="file-name">{file.name}</span>
          <span className="file-path">{file.path}</span>
          {isConnected && (
            <span className="connection-indicator connected">
              <span className="dot"></span>
              Live
            </span>
          )}
        </div>
        
        <div className="editor-actions">
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="language-selector"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="c">C</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
          
          <button 
            onClick={handleRunCode}
            disabled={isRunning}
            className="btn btn-primary run-button"
          >
            {isRunning ? (
              <>
                <span className="spinner"></span>
                Running...
              </>
            ) : (
              <>
                <span className="play-icon">▶</span>
                Run
              </>
            )}
          </button>
        </div>
      </div>

      <div className="editor-body">
        <div className="code-editor">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: true },
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              suggest: {
                showKeywords: true,
                showSnippets: true
              }
            }}
          />
          
          {/* Collaborative cursors overlay */}
          <div className="collaborative-cursors">
            {Array.from(cursors.entries()).map(([userId, position]) => {
              const collaborator = collaborators.find(c => c.id === userId);
              return collaborator ? (
                <div
                  key={userId}
                  className={`cursor cursor-${collaborator.color}`}
                  style={{
                    top: `${position.line * 19}px`,
                    left: `${position.column * 7}px`
                  }}
                >
                  <div className="cursor-flag">
                    {collaborator.name}
                  </div>
                </div>
              ) : null;
            })}
          </div>
        </div>

        {output && (
          <div className="output-panel">
            <div className="output-header">
              <span>Output</span>
              <button 
                onClick={() => setOutput('')}
                className="btn btn-sm clear-output"
              >
                Clear
              </button>
            </div>
            <pre className="output-content">{output}</pre>
          </div>
        )}
      </div>

      <div className="editor-footer">
        <div className="editor-stats">
          <span>Line {cursors.get(userId)?.line || 1}</span>
          <span>Column {cursors.get(userId)?.column || 1}</span>
          <span>{code.length} characters</span>
        </div>
        
        <div className="collaborator-indicators">
          {collaborators.map(collaborator => (
            <div 
              key={collaborator.id}
              className={`collaborator-indicator color-${collaborator.color}`}
              title={collaborator.name}
            >
              {collaborator.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
