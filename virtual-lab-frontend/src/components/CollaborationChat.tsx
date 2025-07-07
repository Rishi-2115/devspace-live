import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage, Collaborator } from '../types/collaboration';
import '../styles/CollaborationChat.css';

interface CollaborationChatProps {
  labId: string;
  collaborators: Collaborator[];
  isVisible: boolean;
  onToggle: () => void;
}

export const CollaborationChat: React.FC<CollaborationChatProps> = ({
  labId,
  collaborators,
  isVisible,
  onToggle
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const { user } = useAuth();
  const { socket, isConnected } = useWebSocket(`/collaboration/${labId}`);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat-message', handleNewMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stopped-typing', handleUserStoppedTyping);

    return () => {
      socket.off('chat-message', handleNewMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stopped-typing', handleUserStoppedTyping);
    };
  }, [socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const handleUserTyping = (data: { userId: string }) => {
    if (data.userId !== user?.id) {
      setIsTyping(prev => [...prev.filter(id => id !== data.userId), data.userId]);
    }
  };

  const handleUserStoppedTyping = (data: { userId: string }) => {
    setIsTyping(prev => prev.filter(id => id !== data.userId));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !socket || !user) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    socket.emit('chat-message', {
      labId,
      message
    });

    setNewMessage('');
    stopTyping();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    
    if (socket && user) {
      socket.emit('user-typing', { labId, userId: user.id });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 1000);
    }
  };

  const stopTyping = () => {
    if (socket && user) {
      socket.emit('user-stopped-typing', { labId, userId: user.id });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getCollaboratorName = (userId: string) => {
    const collaborator = collaborators.find(c => c.id === userId);
    return collaborator?.name || 'Unknown User';
  };

  const getCollaboratorColor = (userId: string) => {
    const collaborator = collaborators.find(c => c.id === userId);
    return collaborator?.color || '#6b7280';
  };

  if (!isVisible) {
    return (
      <div className="chat-toggle">
        <button 
          className="chat-toggle-btn"
          onClick={onToggle}
          title="Open Chat"
        >
          💬
          {messages.length > 0 && (
            <span className="chat-notification">{messages.length}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="collaboration-chat">
      <div className="chat-header">
        <div className="chat-title">
          <span>Team Chat</span>
          <div className="connection-status">
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <button className="chat-close-btn" onClick={onToggle}>✕</button>
      </div>

      <div className="chat-participants">
        <div className="participants-list">
          {collaborators.map(collaborator => (
            <div key={collaborator.id} className="participant">
              <div 
                className="participant-avatar"
                style={{ backgroundColor: collaborator.color }}
              >
                {collaborator.name.charAt(0).toUpperCase()}
              </div>
              <span className="participant-name">{collaborator.name}</span>
              {collaborator.isActive && (
                <div className="active-indicator"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.userId === user?.id ? 'own-message' : ''}`}
          >
            <div className="message-header">
              <span 
                className="message-author"
                style={{ color: getCollaboratorColor(message.userId) }}
              >
                {message.userName}
              </span>
              <span className="message-time">
                {formatTime(message.timestamp)}
              </span>
            </div>
            <div className="message-content">
              {message.content}
            </div>
          </div>
        ))}
        
        {isTyping.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">
              {isTyping.map(userId => getCollaboratorName(userId)).join(', ')} 
              {isTyping.length === 1 ? ' is' : ' are'} typing...
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <div className="input-container">
          <textarea
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message... (Enter to send)"
            rows={1}
            disabled={!isConnected}
          />
          <button 
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className="send-btn"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};
