import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/current-user');
      setUser(response.data);
    } catch (error) {
      // In development, automatically attempt dev-login
      if (process.env.NODE_ENV === 'development') {
        try {
          await api.get('/api/auth/dev-login');
          // Re-check auth after dev login
          const authResponse = await api.get('/api/auth/current-user');
          setUser(authResponse.data);
          return;
        } catch (devError) {
          // Dev login failed, fall through to set user null
        }
      }

      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = () => {
    const baseUrl = window.location.origin;
    window.location.href = `${baseUrl}/api/auth/google`;
  };

  const logout = async () => {
    try {
      await api.get('/api/auth/logout');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout,
      refreshAuth: checkAuth  // Expose the refresh function
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 