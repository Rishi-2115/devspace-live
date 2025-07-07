import { useState, useEffect, useCallback } from 'react';
import { Collaborator } from '../types/collaboration';

export const useCollaboration = (labId: string, userId: string) => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const joinSession = useCallback(async (sessionId: string) => {
    // Simulate connection delay
    setTimeout(() => {
      setIsConnected(true);
      
      // Add mock collaborators
      const mockCollaborators: Collaborator[] = [
        {
          id: userId,
          name: 'You',
          email: 'you@example.com',
          color: 'blue',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          isActive: true,
          cursor: { line: 1, column: 1 }
        },
        {
          id: 'user-2',
          name: 'Alice Developer',
          email: 'alice@example.com',
          color: 'green',
          role: 'editor',
          joinedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          lastSeen: new Date().toISOString(),
          isActive: true,
          cursor: { line: 10, column: 5 }
        }
      ];
      
      setCollaborators(mockCollaborators);
    }, 1000);
  }, [userId]);

  const leaveSession = useCallback(() => {
    setIsConnected(false);
    setCollaborators([]);
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      leaveSession();
    };
  }, [leaveSession]);

  return {
    collaborators,
    isConnected,
    joinSession,
    leaveSession
  };
};
