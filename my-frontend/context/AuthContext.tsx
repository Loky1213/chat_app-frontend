'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';
import { useRouter } from 'next/navigation';

export interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (loginPayload: Record<string, string>) => Promise<void>;
  register: (registerPayload: Record<string, string>) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const decodeToken = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      setIsAuthenticated(true);
      const decoded = decodeToken(token);
      if (decoded && decoded.user_id) {
        setUser({ id: decoded.user_id, username: 'You', email: '' });
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
    setLoading(false);
  }, []);

  const login = async (credentials: Record<string, string>) => {
    try {
      const loginPayload = {
        login: credentials.login || credentials.email || credentials.username || '',
        password: credentials.password
      };

      const response = await apiClient.post('/api/user/login/', loginPayload);
      const data = response.data;
      
      const payload = data.data || data;
      const accessToken = payload.access || payload.token || payload.access_token; 
      const refreshToken = payload.refresh || payload.refresh_token;
      
      if (accessToken && typeof window !== 'undefined') {
        localStorage.setItem('access_token', accessToken);
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }
        setIsAuthenticated(true);
        if (payload.user) {
          setUser(payload.user);
        } else {
          // Fallback to natively decode token if backend didn't return user object
          const decoded = decodeToken(accessToken);
          if (decoded && decoded.user_id) {
            setUser({ id: decoded.user_id, username: 'You', email: '' });
          }
        }
        router.push('/chat'); // Redirect to protected route
      } else {
        throw new Error('No token received from backend');
      }
    } catch (error: any) {
      console.error('Login error', error);
      let message = 'Login failed. Please check your credentials.';
      if (error.response?.status === 401) {
        message = 'Invalid username/email or password.';
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }
      throw new Error(message);
    }
  };

  const register = async (credentials: Record<string, string>) => {
    try {
      await apiClient.post('/api/user/register/', credentials);
      router.push('/login'); // Redirect to login on success
    } catch (error) {
      console.error('Register error', error);
      throw error;
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
    setUser(null);
    setIsAuthenticated(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
