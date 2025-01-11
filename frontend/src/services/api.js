import axios from 'axios';

const API_BASE_URL = '';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export { api };

export const createWishlistItem = async (data) => {
  try {
    const response = await api.post('/api/wishlist', data);
    return response.data;
  } catch (error) {
    console.error('Error creating wishlist item:', error);
    throw error;
  }
};

export const updateWishlistItem = async (itemId, updates) => {
  const response = await api.put(`/api/wishlist/${itemId}`, updates);
  return response.data;
};

export const deleteWishlistItem = async (id) => {
  const response = await api.delete(`/api/wishlist/${id}`);
  return response.data;
};

export const fetchLists = async () => {
  const response = await api.get('/api/lists');
  return response.data;
};

export const createList = async (listData) => {
  const response = await api.post('/api/lists', listData);
  return response.data;
};

export const updateList = async (listId, listData) => {
  try {
    console.log('Making update request:', { listId, listData });
    const response = await api.put(`/api/lists/${listId}`, listData);
    console.log('Update response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating list:', error);
    throw error;
  }
};

export const deleteList = async (listId) => {
  const response = await api.delete(`/api/lists/${listId}`);
  return response.data;
};

export const fetchListItems = async (listId) => {
  const response = await api.get(`/api/lists/${listId}`);
  return response.data;
};

export const shareList = async (listId, email) => {
  const response = await api.post(`/api/share/${listId}`, { email });
  return response.data;
};

export const getSharedUsers = async (listId) => {
  try {
    console.log('Making API request to get shared users for list:', listId);
    const response = await api.get(`/api/share/${listId}/shared-with`);
    console.log('API response for shared users:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching shared users:', error);
    throw error;
  }
};

export const unshareList = async (listId, userId) => {
  const response = await api.delete(`/api/share/${listId}/unshare/${userId}`);
  return response.data;
};

export const getSharedWithMe = async () => {
  const response = await api.get('/api/share/shared-with-me');
  return response.data;
};

export const claimItem = async (listId, itemId) => {
  const response = await api.post(`/api/share/claim/${listId}/${itemId}`, {});
  return response.data;
};
