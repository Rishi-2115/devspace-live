import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useWebSocket = (namespace: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const baseUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3002';
    const fullUrl = `${baseUrl}${namespace}`;
    
    console.log('Connecting WebSocket to:', fullUrl);
    
    const socketInstance = io(fullUrl, {
      transports: ['websocket', 'polling'], // Allow fallback to polling
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      forceNew: true // Force a new connection
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected to:', namespace);
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setError(error.message);
      reconnectAttempts.current++;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError('Failed to connect after multiple attempts');
      }
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    });

    socketInstance.on('reconnect_error', (error) => {
      setError(`Reconnection failed: ${error.message}`);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [namespace]);

  const emit = (event: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  };

  const on = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event: string, callback?: (data: any) => void) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  return {
    socket,
    isConnected,
    error,
    emit,
    on,
    off
  };
};
