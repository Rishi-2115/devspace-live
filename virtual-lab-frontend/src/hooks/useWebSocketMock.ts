import { useState, useEffect } from 'react';

export const useWebSocket = (namespace: string) => {
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create a mock socket object
    const mockSocket = {
      on: (event: string, callback: (...args: any[]) => void) => {
        console.log(`Mock socket listening for ${event}`);
      },
      off: (event: string, callback: (...args: any[]) => void) => {
        console.log(`Mock socket stopped listening for ${event}`);
      },
      emit: (event: string, data: any) => {
        console.log(`Mock socket emitting ${event}:`, data);
      },
      disconnect: () => {
        console.log('Mock socket disconnected');
        setIsConnected(false);
      }
    };

    setSocket(mockSocket);
    
    // Simulate connection after a delay
    setTimeout(() => {
      setIsConnected(true);
    }, 1000);

    return () => {
      mockSocket.disconnect();
    };
  }, [namespace]);

  return { socket, isConnected };
};
