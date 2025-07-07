import { Server, Socket } from 'socket.io';
import { redis } from '../config/database';
import { OperationalTransform } from '../utils/operationalTransform';

interface DocumentOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  authorId: string;
  timestamp: number;
  operationId: string;
}

interface CollaborativeDocument {
  id: string;
  content: string;
  version: number;
  activeUsers: Map<string, UserCursor>;
  operationHistory: DocumentOperation[];
}

interface UserCursor {
  userId: string;
  position: number;
  selection?: { start: number; end: number };
  color: string;
}

export class CollaborationService {
  private documents: Map<string, CollaborativeDocument> = new Map();
  private ot: OperationalTransform;

  constructor(private io: Server) {
    this.ot = new OperationalTransform();
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`User connected: ${socket.id}`);

      socket.on('join-document', async (data) => {
        await this.handleJoinDocument(socket, data);
      });

      socket.on('document-operation', async (data) => {
        await this.handleDocumentOperation(socket, data);
      });

      socket.on('cursor-update', (data) => {
        this.handleCursorUpdate(socket, data);
      });

      socket.on('start-voice-chat', (data) => {
        this.handleVoiceChatStart(socket, data);
      });

      socket.on('start-screen-share', (data) => {
        this.handleScreenShareStart(socket, data);
      });

      socket.on('whiteboard-operation', (data) => {
        this.handleWhiteboardOperation(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinDocument(socket: Socket, data: { documentId: string; userId: string }) {
    const { documentId, userId } = data;
    
    // Join socket room
    socket.join(documentId);
    
    // Get or create document
    let document = await this.getDocument(documentId);
    if (!document) {
      document = await this.createDocument(documentId);
    }

    // Add user cursor
    const userColor = this.generateUserColor(userId);
    document.activeUsers.set(userId, {
      userId,
      position: 0,
      color: userColor
    });

    // Send current document state to joining user
    socket.emit('document-state', {
      content: document.content,
      version: document.version,
      activeUsers: Array.from(document.activeUsers.values())
    });

    // Notify other users of new participant
    socket.to(documentId).emit('user-joined', {
      userId,
      color: userColor
    });

        // Store user-document association
    await redis.sadd(`document:${documentId}:users`, userId);
    await redis.set(`user:${socket.id}:document`, documentId);
    await redis.set(`user:${socket.id}:userId`, userId);
  }

  private async handleDocumentOperation(socket: Socket, data: DocumentOperation) {
    const documentId = await redis.get(`user:${socket.id}:document`);
    if (!documentId) return;

    const document = await this.getDocument(documentId);
    if (!document) return;

    try {
      // Transform operation against concurrent operations
      const transformedOperation = await this.transformOperation(document, data);
      
      // Apply operation to document
      const newContent = this.applyOperation(document.content, transformedOperation);
      
      // Update document
      document.content = newContent;
      document.version++;
      document.operationHistory.push(transformedOperation);
      
      // Persist to Redis
      await this.saveDocument(document);
      
      // Broadcast to other users
      socket.to(documentId).emit('document-operation', {
        operation: transformedOperation,
        version: document.version,
        content: newContent
      });

      // Send acknowledgment to sender
      socket.emit('operation-ack', {
        operationId: data.operationId,
        version: document.version
      });

    } catch (error) {
      console.error('Error handling document operation:', error);
      socket.emit('operation-error', {
        operationId: data.operationId,
        error: 'Failed to apply operation'
      });
    }
  }

  private async transformOperation(document: CollaborativeDocument, operation: DocumentOperation): Promise<DocumentOperation> {
    // Get concurrent operations since the operation's base version
    const concurrentOps = document.operationHistory.filter(op => 
      op.timestamp > operation.timestamp && op.authorId !== operation.authorId
    );

    // Apply operational transformation
    let transformedOp = { ...operation };
    for (const concurrentOp of concurrentOps) {
      transformedOp = this.ot.transform(transformedOp, concurrentOp);
    }

    return transformedOp;
  }

  private applyOperation(content: string, operation: DocumentOperation): string {
    switch (operation.type) {
      case 'insert':
        return content.slice(0, operation.position) + 
               operation.content + 
               content.slice(operation.position);
      
      case 'delete':
        return content.slice(0, operation.position) + 
               content.slice(operation.position + (operation.length || 0));
      
      default:
        return content;
    }
  }

  private handleCursorUpdate(socket: Socket, data: { position: number; selection?: { start: number; end: number } }) {
    const documentId = redis.get(`user:${socket.id}:document`);
    const userId = redis.get(`user:${socket.id}:userId`);
    
    if (!documentId || !userId) return;

    // Broadcast cursor position to other users
    socket.to(documentId).emit('cursor-update', {
      userId,
      position: data.position,
      selection: data.selection
    });
  }

  private handleVoiceChatStart(socket: Socket, data: { offer?: any; answer?: any; candidate?: any }) {
    const documentId = redis.get(`user:${socket.id}:document`);
    if (!documentId) return;

    // Relay WebRTC signaling to other users in the document
    socket.to(documentId).emit('voice-chat-signal', {
      from: socket.id,
      ...data
    });
  }

  private handleScreenShareStart(socket: Socket, data: { stream: any }) {
    const documentId = redis.get(`user:${socket.id}:document`);
    if (!documentId) return;

    // Notify other users about screen share
    socket.to(documentId).emit('screen-share-started', {
      userId: socket.id,
      stream: data.stream
    });
  }

  private handleWhiteboardOperation(socket: Socket, data: any) {
    const documentId = redis.get(`user:${socket.id}:document`);
    if (!documentId) return;

    // Broadcast whiteboard changes to other users
    socket.to(documentId).emit('whiteboard-operation', data);
  }

  private async handleDisconnect(socket: Socket) {
    const documentId = await redis.get(`user:${socket.id}:document`);
    const userId = await redis.get(`user:${socket.id}:userId`);
    
    if (documentId && userId) {
      // Remove user from document
      await redis.srem(`document:${documentId}:users`, userId);
      
      // Notify other users
      socket.to(documentId).emit('user-left', { userId });
      
      // Clean up document if no users left
      const remainingUsers = await redis.scard(`document:${documentId}:users`);
      if (remainingUsers === 0) {
        await this.cleanupDocument(documentId);
      }
    }

    // Clean up user data
    await redis.del(`user:${socket.id}:document`);
    await redis.del(`user:${socket.id}:userId`);
  }

  private async getDocument(documentId: string): Promise<CollaborativeDocument | null> {
    const cached = this.documents.get(documentId);
    if (cached) return cached;

    const documentData = await redis.get(`document:${documentId}`);
    if (!documentData) return null;

    const document = JSON.parse(documentData);
    document.activeUsers = new Map();
    this.documents.set(documentId, document);
    
    return document;
  }

  private async createDocument(documentId: string): Promise<CollaborativeDocument> {
    const document: CollaborativeDocument = {
      id: documentId,
      content: '',
      version: 0,
      activeUsers: new Map(),
      operationHistory: []
    };

    this.documents.set(documentId, document);
    await this.saveDocument(document);
    
    return document;
  }

  private async saveDocument(document: CollaborativeDocument): Promise<void> {
    const documentData = {
      ...document,
      activeUsers: undefined // Don't persist active users
    };
    
    await redis.set(`document:${document.id}`, JSON.stringify(documentData));
  }

  private generateUserColor(userId: string): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  private async cleanupDocument(documentId: string): Promise<void> {
    this.documents.delete(documentId);
    await redis.del(`document:${documentId}`);
    await redis.del(`document:${documentId}:users`);
  }
}
