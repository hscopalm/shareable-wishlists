import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchLists } from '../services/api';

const ListContext = createContext();

export function ListProvider({ children }) {
  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [isSharedList, setIsSharedList] = useState(false);
  const [loading, setLoading] = useState(true);

  // Use useCallback to memoize the loadLists function
  const loadLists = useCallback(async () => {
    try {
      const data = await fetchLists();
      setLists(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading lists:', error);
      setLoading(false);
    }
  }, []);

  // Add this function back
  const setCurrentListWithSharedStatus = useCallback((list, isShared = false) => {
    setCurrentList(list);
    setIsSharedList(isShared);
  }, []);

  // Only fetch lists once when the component mounts
  useEffect(() => {
    loadLists();
  }, [loadLists]);

  return (
    <ListContext.Provider value={{ 
      lists, 
      setLists,
      currentList,
      setCurrentList: setCurrentListWithSharedStatus,
      isSharedList, 
      setIsSharedList,
      loading,
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