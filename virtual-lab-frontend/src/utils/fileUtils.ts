import { getFileExtension, formatFileSize } from './helper';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileNode[];
  isExpanded?: boolean;
}

export interface FileContent {
  content: string;
  encoding: 'utf8' | 'base64';
  size: number;
  modified: Date;
}

/**
 * Build file tree from flat file list
 */
export const buildFileTree = (files: Array<{ path: string; type: 'file' | 'directory'; size?: number; modified?: string }>): FileNode[] => {
  const root: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  // Sort files to ensure directories come before their contents
  const sortedFiles = files.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.path.localeCompare(b.path);
  });

  for (const file of sortedFiles) {
    const parts = file.path.split('/').filter(Boolean);
    let currentPath = '';
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      let node = nodeMap.get(currentPath);
      
      if (!node) {
        const isLastPart = i === parts.length - 1;
        node = {
          name: part,
          path: currentPath,
          type: isLastPart ? file.type : 'directory',
          size: isLastPart ? file.size : undefined,
          modified: file.modified ? new Date(file.modified) : undefined,
          children: file.type === 'directory' || !isLastPart ? [] : undefined,
          isExpanded: false,
        };
        
        nodeMap.set(currentPath, node);
        currentLevel.push(node);
      }
      
      if (node.children) {
        currentLevel = node.children;
      }
    }
  }

  return root;
};

/**
 * Flatten file tree to array
 */
export const flattenFileTree = (nodes: FileNode[]): FileNode[] => {
  const result: FileNode[] = [];
  
  const traverse = (nodes: FileNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children) {
        traverse(node.children);
      }
    }
  };
  
  traverse(nodes);
  return result;
};

/**
 * Find node in file tree by path
 */
export const findNodeByPath = (nodes: FileNode[], path: string): FileNode | null => {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  
  return null;
};

/**
 * Get parent directory path
 */
export const getParentPath = (path: string): string => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash > 0 ? path.substring(0, lastSlash) : '';
};

/**
 * Get filename from path
 */
export const getFileName = (path: string): string => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash !== -1 ? path.substring(lastSlash + 1) : path;
};

/**
 * Get directory name from path
 */
export const getDirName = (path: string): string => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash !== -1 ? path.substring(0, lastSlash) : '';
};

/**
 * Join path segments
 */
export const joinPath = (...segments: string[]): string => {
  return segments
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');
};

/**
 * Normalize path (remove ./ and ../)
 */
export const normalizePath = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  const normalized: string[] = [];
  
  for (const part of parts) {
    if (part === '..') {
      normalized.pop();
    } else if (part !== '.') {
      normalized.push(part);
    }
  }
  
  return normalized.join('/');
};

/**
 * Check if path is valid filename
 */
export const isValidFileName = (name: string): boolean => {
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(name)) return false;
  
  // Check for reserved names (Windows)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(name)) return false;
  
  // Check length
  if (name.length === 0 || name.length > 255) return false;
  
  // Check for leading/trailing spaces or dots
  if (name.startsWith(' ') || name.endsWith(' ') || name.endsWith('.')) return false;
  
  return true;
};

/**
 * Check if file is binary based on extension
 */
export const isBinaryFile = (filename: string): boolean => {
  const binaryExtensions = [
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
    '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.wmv',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
    '.class', '.jar', '.war', '.ear',
  ];
  
  const extension = getFileExtension(filename).toLowerCase();
  return binaryExtensions.includes(extension);
};

/**
 * Check if file is image
 */
export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'];
  const extension = getFileExtension(filename).toLowerCase();
  return imageExtensions.includes(extension);
};

/**
 * Check if file is text file
 */
export const isTextFile = (filename: string): boolean => {
  return !isBinaryFile(filename);
};

/**
 * Get MIME type from filename
 */
export const getMimeType = (filename: string): string => {
  const extension = getFileExtension(filename).toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
};

/**
 * Sort file nodes
 */
export const sortFileNodes = (nodes: FileNode[], sortBy: 'name' | 'size' | 'modified' = 'name', ascending: boolean = true): FileNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    // Directories first
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'modified':
        const aTime = a.modified?.getTime() || 0;
        const bTime = b.modified?.getTime() || 0;
        comparison = aTime - bTime;
        break;
    }
    
    return ascending ? comparison : -comparison;
  });
  
  // Recursively sort children
  return sorted.map(node => ({
    ...node,
    children: node.children ? sortFileNodes(node.children, sortBy, ascending) : undefined,
  }));
};

/**
 * Filter file nodes by search term
 */
export const filterFileNodes = (nodes: FileNode[], searchTerm: string): FileNode[] => {
  if (!searchTerm) return nodes;
  
  const filtered: FileNode[] = [];
  const term = searchTerm.toLowerCase();
  
  for (const node of nodes) {
    const matches = node.name.toLowerCase().includes(term);
    const filteredChildren = node.children ? filterFileNodes(node.children, searchTerm) : undefined;
    
    if (matches || (filteredChildren && filteredChildren.length > 0)) {
      filtered.push({
        ...node,
        children: filteredChildren,
        isExpanded: filteredChildren && filteredChildren.length > 0 ? true : node.isExpanded,
      });
    }
  }
  
  return filtered;
};

/**
 * Get file tree statistics
 */
export const getFileTreeStats = (nodes: FileNode[]): { files: number; directories: number; totalSize: number } => {
  let files = 0;
  let directories = 0;
  let totalSize = 0;
  
  const traverse = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') {
        files++;
        totalSize += node.size || 0;
      } else {
        directories++;
      }
      
      if (node.children) {
        traverse(node.children);
      }
    }
  };
  
  traverse(nodes);
  
  return { files, directories, totalSize };
};

/**
 * Create breadcrumb from path
 */
export const createBreadcrumb = (path: string): Array<{ name: string; path: string }> => {
  if (!path) return [];
  
  const parts = path.split('/').filter(Boolean);
  const breadcrumb: Array<{ name: string; path: string }> = [];
  
  let currentPath = '';
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    breadcrumb.push({
      name: part,
      path: currentPath,
    });
  }
  
  return breadcrumb;
};

/**
 * Check if path is ancestor of another path
 */
export const isAncestorPath = (ancestorPath: string, descendantPath: string): boolean => {
  if (ancestorPath === descendantPath) return false;
  return descendantPath.startsWith(ancestorPath + '/');
};

/**
 * Get relative path from base path
 */
export const getRelativePath = (basePath: string, targetPath: string): string => {
  if (!basePath) return targetPath;
  if (targetPath.startsWith(basePath + '/')) {
    return targetPath.substring(basePath.length + 1);
  }
  return targetPath;
};

/**
 * Validate file upload
 */
export const validateFileUpload = (file: File, maxSize: number = 10 * 1024 * 1024): { valid: boolean; error?: string } => {
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`,
    };
  }
  
  if (!isValidFileName(file.name)) {
    return {
      valid: false,
      error: 'Invalid filename',
    };
  }
  
  return { valid: true };
};

/**
 * Generate unique filename if file already exists
 */
export const generateUniqueFileName = (filename: string, existingFiles: string[]): string => {
  if (!existingFiles.includes(filename)) {
    return filename;
  }
  
  const extension = getFileExtension(filename);
  const baseName = filename.substring(0, filename.length - extension.length);
  
  let counter = 1;
  let newName: string;
  
  do {
    newName = `${baseName} (${counter})${extension}`;
    counter++;
  } while (existingFiles.includes(newName));
  
  return newName;
};
