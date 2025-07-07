import React, { useState, useEffect, useRef } from 'react';
import { FileNode } from '../types/virtualLab';
import { useVirtualLab } from '../hooks/useVirtualLab';
import '../styles/FileExplorer.css';

interface FileExplorerProps {
  labId: string;
  onFileSelect: (file: FileNode) => void;
  onFileCreate: (path: string, type: 'file' | 'folder') => void;
  onFileDelete: (path: string) => void;
  activeFile: FileNode | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  labId,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  activeFile
}) => {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
  } | null>(null);
  const [isCreating, setIsCreating] = useState<{
    parentPath: string;
    type: 'file' | 'folder';
  } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  
  const fileExplorerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getFileTree, createFile, deleteFile, renameFile } = useVirtualLab(labId, '');

  useEffect(() => {
    loadFileTree();
  }, [labId]);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu && !fileExplorerRef.current?.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  const loadFileTree = async () => {
    try {
      console.log('Loading file tree for lab:', labId);
      const tree = await getFileTree();
      console.log('File tree loaded:', tree);
      setFileTree(tree);
    } catch (error) {
      console.error('Error loading file tree:', error);
    }
  };

  const handleFileClick = (file: FileNode) => {
    if (file.type === 'file') {
      onFileSelect(file);
    } else {
      toggleFolder(file.path);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleContextMenu = (event: React.MouseEvent, node: FileNode) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node
    });
  };

  const handleCreateItem = (type: 'file' | 'folder', parentPath: string = '') => {
    setIsCreating({ parentPath, type });
    setNewItemName('');
    setContextMenu(null);
  };

  const handleCreateSubmit = async () => {
    if (!isCreating || !newItemName.trim()) return;

    const fullPath = isCreating.parentPath 
      ? `${isCreating.parentPath}/${newItemName}`
      : newItemName;

    try {
      console.log('Creating file:', { fullPath, type: isCreating.type });
      await onFileCreate(fullPath, isCreating.type);
      console.log('File created, refreshing file tree...');
      await loadFileTree();
      setIsCreating(null);
      setNewItemName('');
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const handleCreateCancel = () => {
    setIsCreating(null);
    setNewItemName('');
  };

  const handleDelete = async (node: FileNode) => {
    if (window.confirm(`Are you sure you want to delete ${node.name}?`)) {
      try {
        await onFileDelete(node.path);
        await loadFileTree();
        setContextMenu(null);
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleRename = async (node: FileNode, newName: string) => {
    try {
      const newPath = node.path.replace(node.name, newName);
      await renameFile(node.path, newPath);
      await loadFileTree();
    } catch (error) {
      console.error('Error renaming item:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const content = event.target?.result as string;
          await createFile(file.name, content);
          await loadFileTree();
        };
        reader.readAsText(file);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileDownload = (node: FileNode) => {
    if (node.type !== 'file') return;

    const content = node.content || '';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = node.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (file: FileNode): string => {
    if (file.type === 'folder') {
      return expandedFolders.has(file.path) ? '📂' : '📁';
    }

    const extension = file.extension?.toLowerCase();
    const iconMap: { [key: string]: string } = {
      '.js': '🟨',
      '.ts': '🔷',
      '.py': '🐍',
      '.java': '☕',
      '.cpp': '⚙️',
      '.c': '⚙️',
      '.html': '🌐',
      '.css': '🎨',
      '.json': '📋',
      '.md': '📝',
      '.txt': '📄',
      '.xml': '📄',
      '.sql': '🗃️'
    };

    return iconMap[extension || ''] || '📄';
  };

  const handleDragStart = (e: React.DragEvent, node: FileNode) => {
    e.dataTransfer.setData('application/json', JSON.stringify(node));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetNode: FileNode) => {
    e.preventDefault();
    
    try {
      const draggedNodeData = e.dataTransfer.getData('application/json');
      const draggedNode = JSON.parse(draggedNodeData) as FileNode;
      
      if (targetNode.type === 'folder' && draggedNode.path !== targetNode.path) {
        const newPath = `${targetNode.path}/${draggedNode.name}`;
        await renameFile(draggedNode.path, newPath);
        await loadFileTree();
      }
    } catch (error) {
      console.error('Error moving file:', error);
    }
  };

  const renderFileNode = (node: FileNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const isActive = activeFile?.path === node.path;

    return (
      <div key={node.path} className="file-node">
        <div
          className={`file-item ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => handleFileClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={node.type === 'folder' ? handleDragOver : undefined}
          onDrop={node.type === 'folder' ? (e) => handleDrop(e, node) : undefined}
        >
          <span className="file-icon">{getFileIcon(node)}</span>
          <span className="file-name">{node.name}</span>
          {node.type === 'file' && (
            <span className="file-size">{formatFileSize(node.size || 0)}</span>
          )}
        </div>

        {node.type === 'folder' && isExpanded && node.children && (
          <div className="folder-children">
            {node.children.map(child => renderFileNode(child, level + 1))}
            {isCreating && isCreating.parentPath === node.path && (
              <div 
                className="file-item creating"
                style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}
              >
                <span className="file-icon">
                  {isCreating.type === 'folder' ? '📁' : '📄'}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit();
                    if (e.key === 'Escape') handleCreateCancel();
                  }}
                  onBlur={handleCreateSubmit}
                  className="file-name-input"
                  placeholder={`New ${isCreating.type} name`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="file-explorer" ref={fileExplorerRef}>
      <div className="file-explorer-header">
        <h3>Files</h3>
        <div className="file-explorer-actions">
          <button
            onClick={() => handleCreateItem('file')}
            className="btn btn-sm"
            title="New File"
          >
            📄
          </button>
          <button
            onClick={() => handleCreateItem('folder')}
            className="btn btn-sm"
            title="New Folder"
          >
            📁
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            multiple
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-sm"
            title="Upload Files"
          >
            📤
          </button>
          <button
            onClick={loadFileTree}
            className="btn btn-sm"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="file-tree">
        {fileTree.map(node => renderFileNode(node))}
        {isCreating && !isCreating.parentPath && (
          <div className="file-item creating" style={{ paddingLeft: '8px' }}>
            <span className="file-icon">
              {isCreating.type === 'folder' ? '📁' : '📄'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubmit();
                if (e.key === 'Escape') handleCreateCancel();
              }}
              onBlur={handleCreateSubmit}
              className="file-name-input"
              placeholder={`New ${isCreating.type} name`}
            />
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000
          }}
        >
          {contextMenu.node?.type === 'folder' && (
            <>
              <button onClick={() => handleCreateItem('file', contextMenu.node!.path)}>
                New File
              </button>
              <button onClick={() => handleCreateItem('folder', contextMenu.node!.path)}>
                New Folder
              </button>
              <div className="context-menu-separator"></div>
            </>
          )}
          {contextMenu.node?.type === 'file' && (
            <>
              <button onClick={() => {
                handleFileDownload(contextMenu.node!);
                setContextMenu(null);
              }}>
                Download
              </button>
              <div className="context-menu-separator"></div>
            </>
          )}
          <button onClick={() => handleDelete(contextMenu.node!)}>
            Delete
          </button>
          <button onClick={() => {
            const newName = prompt('Enter new name:', contextMenu.node!.name);
            if (newName && newName !== contextMenu.node!.name) {
              handleRename(contextMenu.node!, newName);
            }
            setContextMenu(null);
          }}>
            Rename
          </button>
        </div>
      )}
    </div>
  );
};
