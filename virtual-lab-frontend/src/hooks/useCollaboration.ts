import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { Collaborator, EditorOperation } from '../types/collaboration';

export const useCollaboration = (labId: string, userId: string) => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { socket } = useWebSocket(`/collaboration/${labId}`);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('collaborators-updated', handleCollaboratorsUpdated);
    socket.on('session-created', handleSessionCreated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('collaborators-updated', handleCollaboratorsUpdated);
      socket.off('session-created', handleSessionCreated);
    };
  }, [socket]);

  const handleConnect = () => {
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  const handleUserJoined = (user: Collaborator) => {
    setCollaborators(prev => {
      if (prev.find(c => c.id === user.id)) return prev;
      return [...prev, user];
    });
  };

  const handleUserLeft = (userId: string) => {
    setCollaborators(prev => prev.filter(c => c.id !== userId));
  };

  const handleCollaboratorsUpdated = (users: Collaborator[]) => {
    setCollaborators(users);
  };

  const handleSessionCreated = (data: { sessionId: string }) => {
    setSessionId(data.sessionId);
  };

  const joinSession = useCallback((sessionId: string) => {
    if (socket && isConnected) {
      socket.emit('join-session', {
        sessionId,
        userId,
        labId
      });
    }
  }, [socket, isConnected, userId, labId]);

  const leaveSession = useCallback(() => {
    if (socket && sessionId) {
      socket.emit('leave-session', {
        sessionId,
        userId
      });
    }
  }, [socket, sessionId, userId]);

  const sendOperation = useCallback((operation: EditorOperation) => {
    if (socket && isConnected && sessionId) {
      socket.emit('operation', {
        ...operation,
        sessionId
      });
    }
  }, [socket, isConnected, sessionId]);

    const sendCursorUpdate = useCallback((position: { line: number; column: number }) => {
    if (socket && isConnected && sessionId) {
      socket.emit('cursor-update', {
        sessionId,
        userId,
        position
      });
    }
  }, [socket, isConnected, sessionId, userId]);

  const sendFileChange = useCallback((fileId: string, content: string) => {
    if (socket && isConnected && sessionId) {
      socket.emit('file-change', {
        sessionId,
        fileId,
        content,
        userId
      });
    }
  }, [socket, isConnected, sessionId, userId]);

  return {
    collaborators,
    isConnected,
    sessionId,
    joinSession,
    leaveSession,
    sendOperation,
    sendCursorUpdate,
    sendFileChange
  };
};

