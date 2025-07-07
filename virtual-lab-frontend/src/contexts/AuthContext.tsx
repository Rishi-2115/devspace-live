import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'student' | 'instructor' | 'admin';
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const initAuth = async () => {
      const savedToken = localStorage.getItem('authToken');
      if (savedToken) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.user);
          setToken(savedToken);
          api.setAuthToken(savedToken);
        } catch (error) {
          console.error('Auth initialization failed:', error);
          // Token is invalid, remove it
          localStorage.removeItem('authToken');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('Attempting login with:', email);
      const response = await api.post('/auth/login', { email, password });
      console.log('Login response:', response.data);
      const { user: userData, token: authToken } = response.data;
      
      setUser(userData);
      setToken(authToken);
      localStorage.setItem('authToken', authToken);
      api.setAuthToken(authToken);
      
      return true;
    } catch (error: any) {
      console.error('Login failed:', error);
      console.error('Error response:', error.response?.data);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('Attempting registration with:', name, email);
      const response = await api.post('/auth/register', { name, email, password });
      console.log('Registration response:', response.data);
      const { user: userData, token: authToken } = response.data;
      
      setUser(userData);
      setToken(authToken);
      localStorage.setItem('authToken', authToken);
      api.setAuthToken(authToken);
      
      return true;
    } catch (error: any) {
      console.error('Registration failed:', error);
      console.error('Error response:', error.response?.data);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    api.removeAuthToken();
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await api.post('/auth/refresh');
      const { token: newToken } = response.data;
      
      setToken(newToken);
      localStorage.setItem('authToken', newToken);
      api.setAuthToken(newToken);
      
      return true;
    } catch (error) {
      logout();
      return false;
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission) || user.role === 'admin';
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    logout,
    register,
    refreshToken,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
