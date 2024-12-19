import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

export const fetchWishlistItems = async () => {
  const response = await api.get('/wishlist');
  return response.data;
};

export const createWishlistItem = async (itemData) => {
  const response = await api.post('/wishlist', itemData);
  return response.data;
};

export const updateWishlistItem = async (id, itemData) => {
  const response = await api.put(`/wishlist/${id}`, itemData);
  return response.data;
};

export const deleteWishlistItem = async (id) => {
  const response = await api.delete(`/wishlist/${id}`);
  return response.data;
}; 