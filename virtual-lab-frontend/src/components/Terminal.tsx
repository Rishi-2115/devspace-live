import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import '../styles/Terminal.css';

interface TerminalProps {
  labId: string;
  isActive: boolean;
}

interface TerminalLine {
  id: string;
  content: string;
  type: 'input' | 'output' | 'error';
  timestamp: number;
}

export const Terminal: React.FC<TerminalProps> = ({ labId, isActive }) => {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isConnected, setIsConnected] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState('~');

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { socket } = useWebSocket(`/terminal/${labId}`);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('terminal-output', handleTerminalOutput);
    socket.on('terminal-error', handleTerminalError);
    socket.on('directory-changed', handleDirectoryChanged);

    // Initialize terminal session
    if (isActive) {
      socket.emit('init-terminal', { labId });
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('terminal-output', handleTerminalOutput);
      socket.off('terminal-error', handleTerminalError);
      socket.off('directory-changed', handleDirectoryChanged);
    };
  }, [socket, labId, isActive]);

  useEffect(() => {
    // Auto-scroll to bottom when new lines are added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    // Focus input when terminal becomes active
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleTerminalOutput = (data: { output: string; type?: string }) => {
    addLine(data.output, data.type === 'error' ? 'error' : 'output');
  };

  const handleTerminalError = (data: { error: string }) => {
    addLine(data.error, 'error');
  };

  const handleDirectoryChanged = (data: { directory: string }) => {
    setCurrentDirectory(data.directory);
  };

  const addLine = (content: string, type: 'input' | 'output' | 'error') => {
    const newLine: TerminalLine = {
      id: `${Date.now()}-${Math.random()}`,
      content,
      type,
      timestamp: Date.now()
    };

    setLines(prev => [...prev, newLine]);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentInput.trim() || !isConnected || !isActive) return;

    // Add input to terminal display
    addLine(`${currentDirectory}$ ${currentInput}`, 'input');

    // Add to command history
    setCommandHistory(prev => [...prev, currentInput]);
    setHistoryIndex(-1);

    // Send command to server
    if (socket) {
      socket.emit('terminal-command', {
        labId,
        command: currentInput
      });
    }

    setCurrentInput('');
  };

   const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentInput('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Auto-complete functionality
      handleAutoComplete();
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      // Send interrupt signal
      if (socket) {
        socket.emit('terminal-interrupt', { labId });
      }
      addLine('^C', 'output');
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      // Clear terminal
      handleClear();
    }
  };

  const handleAutoComplete = () => {
    if (!currentInput.trim() || !socket) return;

    socket.emit('terminal-autocomplete', {
      labId,
      input: currentInput
    });

    // Listen for autocomplete response
    socket.once('terminal-autocomplete-response', (data: { suggestions: string[] }) => {
      if (data.suggestions.length === 1) {
        // Single match - complete it
        setCurrentInput(data.suggestions[0]);
      } else if (data.suggestions.length > 1) {
        // Multiple matches - show them
        addLine(`Suggestions: ${data.suggestions.join(', ')}`, 'output');
      }
    });
  };

  const handleClear = () => {
    setLines([]);
  };

  const handleTerminalClick = () => {
    if (inputRef.current && isActive) {
      inputRef.current.focus();
    }
  };

  const getLineClassName = (type: string) => {
    switch (type) {
      case 'input': return 'terminal-line-input';
      case 'error': return 'terminal-line-error';
      case 'output': return 'terminal-line-output';
      default: return 'terminal-line';
    }
  };

  const formatContent = (content: string) => {
    // Handle ANSI color codes and special characters
    return content
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes for now
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  };

  return (
    <div className={`terminal ${isActive ? 'active' : 'inactive'}`}>
      <div className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-icon">⚡</span>
          <span>Terminal</span>
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '●' : '○'}
          </span>
        </div>
        
        <div className="terminal-controls">
          <button 
            onClick={handleClear}
            className="btn btn-sm"
            title="Clear terminal"
          >
            🗑️
          </button>
          <button 
            onClick={() => {
              if (socket) {
                socket.emit('terminal-interrupt', { labId });
              }
            }}
            className="btn btn-sm"
            title="Interrupt (Ctrl+C)"
          >
            ⏹️
          </button>
        </div>
      </div>

      <div 
        className="terminal-body"
        ref={terminalRef}
        onClick={handleTerminalClick}
      >
        {!isActive && (
          <div className="terminal-inactive-message">
            <p>Terminal is not active</p>
            <p>Start the lab to use the terminal</p>
          </div>
        )}

        {isActive && (
          <>
            <div className="terminal-lines">
              {lines.map(line => (
                <div key={line.id} className={getLineClassName(line.type)}>
                  <pre>{formatContent(line.content)}</pre>
                </div>
              ))}
            </div>

            <form onSubmit={handleInputSubmit} className="terminal-input-form">
              <div className="terminal-prompt">
                <span className="prompt-path">{currentDirectory}</span>
                <span className="prompt-symbol">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="terminal-input"
                  disabled={!isConnected || !isActive}
                  placeholder={isConnected ? "Enter command..." : "Connecting..."}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </form>
          </>
        )}
      </div>

      <div className="terminal-footer">
        <div className="terminal-info">
          <span>Lines: {lines.length}</span>
          <span>History: {commandHistory.length}</span>
          {isActive && (
            <span className="terminal-shortcuts">
              Shortcuts: ↑↓ (history), Tab (complete), Ctrl+C (interrupt), Ctrl+L (clear)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
