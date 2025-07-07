export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
  },
  LABS: {
    LIST: '/labs',
    CREATE: '/labs',
    GET: (id: string) => `/labs/${id}`,
    UPDATE: (id: string) => `/labs/${id}`,
    DELETE: (id: string) => `/labs/${id}`,
    START: (id: string) => `/labs/${id}/start`,
    STOP: (id: string) => `/labs/${id}/stop`,
    STATUS: (id: string) => `/labs/${id}/status`,
  },
  FILES: {
    LIST: (labId: string) => `/labs/${labId}/files`,
    READ: (labId: string, path: string) => `/labs/${labId}/files/read?path=${encodeURIComponent(path)}`,
    WRITE: (labId: string) => `/labs/${labId}/files/write`,
    DELETE: (labId: string) => `/labs/${labId}/files/delete`,
    UPLOAD: (labId: string) => `/labs/${labId}/files/upload`,
  },
  TERMINAL: {
    CONNECT: (labId: string) => `/labs/${labId}/terminal`,
    EXECUTE: (labId: string) => `/labs/${labId}/terminal/execute`,
  },
  COLLABORATION: {
    SHARE: (labId: string) => `/labs/${labId}/share`,
    USERS: (labId: string) => `/labs/${labId}/users`,
    CHAT: (labId: string) => `/labs/${labId}/chat`,
  },
  MONITORING: {
    RESOURCES: (labId: string) => `/labs/${labId}/resources`,
    PROCESSES: (labId: string) => `/labs/${labId}/processes`,
  },
};

export const WEBSOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Lab events
  LAB_STATUS_CHANGED: 'lab:status_changed',
  LAB_UPDATED: 'lab:updated',
  
  // File events
  FILE_CHANGED: 'file:changed',
  FILE_CREATED: 'file:created',
  FILE_DELETED: 'file:deleted',
  
  // Editor events
  EDITOR_CURSOR_MOVED: 'editor:cursor_moved',
  EDITOR_SELECTION_CHANGED: 'editor:selection_changed',
  EDITOR_TEXT_CHANGED: 'editor:text_changed',
  
  // Terminal events
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  
  // Collaboration events
  USER_JOINED: 'collaboration:user_joined',
  USER_LEFT: 'collaboration:user_left',
  USER_CURSOR_MOVED: 'collaboration:cursor_moved',
  CHAT_MESSAGE: 'collaboration:chat_message',
  
  // Resource monitoring
  RESOURCE_UPDATE: 'monitoring:resource_update',
  PROCESS_UPDATE: 'monitoring:process_update',
};

export const LAB_STATUS = {
  CREATING: 'creating',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error',
} as const;

export const FILE_TYPES = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  PYTHON: 'python',
  JAVA: 'java',
  CPP: 'cpp',
  C: 'c',
  HTML: 'html',
  CSS: 'css',
  JSON: 'json',
  XML: 'xml',
  MARKDOWN: 'markdown',
  TEXT: 'text',
  BINARY: 'binary',
} as const;

export const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', extensions: ['.js', '.mjs'] },
  { id: 'typescript', name: 'TypeScript', extensions: ['.ts', '.tsx'] },
  { id: 'python', name: 'Python', extensions: ['.py', '.pyw'] },
  { id: 'java', name: 'Java', extensions: ['.java'] },
  { id: 'cpp', name: 'C++', extensions: ['.cpp', '.cxx', '.cc'] },
  { id: 'c', name: 'C', extensions: ['.c', '.h'] },
  { id: 'html', name: 'HTML', extensions: ['.html', '.htm'] },
  { id: 'css', name: 'CSS', extensions: ['.css', '.scss', '.sass'] },
  { id: 'json', name: 'JSON', extensions: ['.json'] },
  { id: 'xml', name: 'XML', extensions: ['.xml'] },
  { id: 'markdown', name: 'Markdown', extensions: ['.md', '.markdown'] },
];

export const DOCKER_TEMPLATES = [
  {
    id: 'node',
    name: 'Node.js',
    description: 'Node.js development environment',
    image: 'node:18-alpine',
    ports: [3000, 8000],
    volumes: ['/workspace'],
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python development environment',
    image: 'python:3.11-alpine',
    ports: [8000, 5000],
    volumes: ['/workspace'],
  },
  {
    id: 'java',
    name: 'Java',
    description: 'Java development environment',
    image: 'openjdk:17-alpine',
    ports: [8080],
    volumes: ['/workspace'],
  },
  {
    id: 'ubuntu',
    name: 'Ubuntu',
    description: 'Ubuntu Linux environment',
    image: 'ubuntu:22.04',
    ports: [22],
    volumes: ['/workspace'],
  },
];

export const KEYBOARD_SHORTCUTS = {
  SAVE_FILE: 'Ctrl+S',
  NEW_FILE: 'Ctrl+N',
  OPEN_FILE: 'Ctrl+O',
  FIND: 'Ctrl+F',
  REPLACE: 'Ctrl+H',
  TOGGLE_TERMINAL: 'Ctrl+`',
  TOGGLE_SIDEBAR: 'Ctrl+B',
  ZOOM_IN: 'Ctrl+=',
  ZOOM_OUT: 'Ctrl+-',
  RESET_ZOOM: 'Ctrl+0',
};

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto',
} as const;

export const LOCAL_STORAGE_KEYS = {
  AUTH_TOKEN: 'virtual_lab_auth_token',
  REFRESH_TOKEN: 'virtual_lab_refresh_token',
  USER_PREFERENCES: 'virtual_lab_user_preferences',
  THEME: 'virtual_lab_theme',
  RECENT_LABS: 'virtual_lab_recent_labs',
  EDITOR_SETTINGS: 'virtual_lab_editor_settings',
};

export const DEFAULT_EDITOR_SETTINGS = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  autoSave: true,
  theme: 'vs-dark',
};

export const RESOURCE_THRESHOLDS = {
  CPU: {
    WARNING: 70,
    CRITICAL: 90,
  },
  MEMORY: {
    WARNING: 80,
    CRITICAL: 95,
  },
  DISK: {
    WARNING: 85,
    CRITICAL: 95,
  },
};

export const COLLABORATION_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_UPLOAD_FILES = 50;
export const WEBSOCKET_RECONNECT_INTERVAL = 5000;
export const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
export const RESOURCE_UPDATE_INTERVAL = 2000; // 2 seconds
