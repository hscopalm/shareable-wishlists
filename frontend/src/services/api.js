import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const fetchWishlistItems = async () => {
  const response = await axios.get(`${API_BASE_URL}/wishlist`);
  return response.data;
};

export const createWishlistItem = async (itemData) => {
  const response = await axios.post(`${API_BASE_URL}/wishlist`, itemData);
  return response.data;
};

export const updateWishlistItem = async (id, itemData) => {
  const formattedData = {
    ...itemData,
    price: itemData.price ? parseFloat(itemData.price) : undefined
  };
  
  const response = await axios.put(`${API_BASE_URL}/wishlist/${id}`, formattedData);
  return response.data;
};

export const deleteWishlistItem = async (id) => {
  const response = await axios.delete(`${API_BASE_URL}/wishlist/${id}`);
  return response.data;
}; 