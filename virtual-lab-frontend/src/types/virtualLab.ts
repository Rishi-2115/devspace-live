export interface VirtualLabInstance {
  id: string;
  name: string;
  description?: string;
  status: 'creating' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  containerId?: string;
  imageId: string;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  environment: { [key: string]: string };
  resources: ResourceLimits;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  ownerId: string;
  collaborators: string[];
  settings: LabSettings;
}

export interface LabConfig {
  name: string;
  description?: string;
  image: string;
  ports?: PortMapping[];
  volumes?: VolumeMapping[];
  environment?: { [key: string]: string };
  resources?: ResourceLimits;
  settings?: Partial<LabSettings>;
}

export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  protocol: 'tcp' | 'udp';
  description?: string;
}

export interface VolumeMapping {
  hostPath?: string;
  containerPath: string;
  mode: 'ro' | 'rw';
  type: 'bind' | 'volume' | 'tmpfs';
  name?: string;
}

export interface ResourceLimits {
  memory?: string; // e.g., "512m", "1g"
  cpu?: string;    // e.g., "0.5", "1.0"
  disk?: string;   // e.g., "1g", "10g"
}

export interface LabSettings {
  autoSave: boolean;
  autoSaveInterval: number; // minutes
  collaborationEnabled: boolean;
  maxCollaborators: number;
  publicAccess: boolean;
  allowFileUpload: boolean;
  allowTerminalAccess: boolean;
  allowNetworkAccess: boolean;
  timeoutMinutes: number;
  snapshotRetention: number; // days
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  extension?: string;
  lastModified?: string;
  content?: string;
  children?: FileNode[];
  permissions?: string;
  owner?: string;
}

export interface LabSnapshot {
  id: string;
  name: string;
  description?: string;
  labId: string;
  createdAt: string;
  size: number;
  metadata: {
    fileCount: number;
    containerState: string;
    version: string;
  };
}

export interface ExecutionResult {
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  language: string;
  timestamp: string;
}

export interface LabTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  tags: string[];
  config: LabConfig;
  popularity: number;
  rating: number;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabUsageStats {
  labId: string;
  totalSessions: number;
  totalDuration: number; // minutes
  averageSessionDuration: number; // minutes
  lastAccessed: string;
  collaboratorCount: number;
  fileOperations: number;
  codeExecutions: number;
  resourceUsage: {
    avgCpu: number;
    avgMemory: number;
    peakCpu: number;
    peakMemory: number;
  };
}
