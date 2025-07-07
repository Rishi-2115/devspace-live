export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  lastSeen: string;
  isActive: boolean;
  cursor?: CursorPosition;
}

export interface CursorPosition {
  line: number;
  column: number;
  fileId?: string;
}

export interface Operation {
  id: string;
  userId: string;
  fileId: string;
  type: 'insert' | 'delete' | 'replace';
  position: {
    line: number;
    column: number;
  };
  content: string;
  length: number;
  timestamp: number;
}

export type EditorOperation = Operation;

export interface CollaborationSession {
  id: string;
  labId: string;
  ownerId: string;
  participants: Collaborator[];
  createdAt: string;
  lastActivity: string;
  isActive: boolean;
  settings: SessionSettings;
}

export interface SessionSettings {
  allowAnonymous: boolean;
  maxParticipants: number;
  requireApproval: boolean;
  allowFileEditing: boolean;
  allowTerminalAccess: boolean;
  sessionTimeout: number; // minutes
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'system' | 'code' | 'file';
  metadata?: {
    fileId?: string;
    fileName?: string;
    language?: string;
    lineNumber?: number;
  };
}

export interface FileChange {
  fileId: string;
  fileName: string;
  userId: string;
  userName: string;
  operation: 'create' | 'update' | 'delete' | 'rename';
  timestamp: string;
  changes?: {
    linesAdded: number;
    linesRemoved: number;
    charactersAdded: number;
    charactersRemoved: number;
  };
}

export interface CollaborationEvent {
  type: 'user-joined' | 'user-left' | 'file-changed' | 'cursor-moved' | 'chat-message' | 'operation';
  userId: string;
  timestamp: string;
  data: any;
}
export interface TextChange {
  type: 'insert' | 'delete' | 'replace';
  position: CursorPosition;
  content: string;
  length: number; // Fix: consistent type
  timestamp: number;
  authorId: string;
}
export interface ConflictResolution {
  operationId: string;
  conflictType: 'concurrent-edit' | 'file-deleted' | 'permission-denied';
  resolution: 'accept' | 'reject' | 'merge';
  resolvedBy: string;
  timestamp: string;
}
export interface FileNode {
  id: string; // Add missing id field
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
  size?: number;
  modified?: Date;
  children?: FileNode[];
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  isActive: boolean;
  cursor?: CursorPosition;
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}
export interface CollaborationState {
  collaborators: Collaborator[];
  operations: EditorOperation[];
  isConnected: boolean;
}


export interface VirtualLabInstance {
  id: string;
  sessionId: string;
  containerId: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  language: string;
  template: string;
  createdAt: number;
  expiresAt: number;
}

export interface LabConfig {
  language: string;
  template: string;
  assignmentId?: string;
}