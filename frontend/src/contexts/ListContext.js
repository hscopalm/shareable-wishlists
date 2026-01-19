import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchLists } from '../services/api';
import { useAuth } from './AuthContext';

const ListContext = createContext();

export function ListProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [isSharedList, setIsSharedList] = useState(false);
  const [loading, setLoading] = useState(true);

  // Use useCallback to memoize the loadLists function
  const loadLists = useCallback(async () => {
    if (!user) {
      setLists([]);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchLists();
      setLists(data);
    } catch (error) {
      console.error('Error loading lists:', error);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add this function back
  const setCurrentListWithSharedStatus = useCallback((list, isShared = false) => {
    setCurrentList(list);
    setIsSharedList(isShared);
  }, []);

  // Only fetch lists once when the component mounts or when user changes
  useEffect(() => {
    if (!authLoading) {  // Only load lists after auth state is determined
      loadLists();
    }
  }, [loadLists, authLoading]);

  return (
    <ListContext.Provider value={{ 
      lists, 
      setLists,
      currentList,
      setCurrentList: setCurrentListWithSharedStatus,
      isSharedList, 
      setIsSharedList,
      loading: loading || authLoading,  // Consider both loading states
      refreshLists: loadLists
    }}>
      {children}
    </ListContext.Provider>
  );
}

export function useList() {
  const context = useContext(ListContext);
  if (!context) {
    throw new Error('useList must be used within a ListProvider');
  }
  return context;
} 