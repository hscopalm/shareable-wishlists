import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { createWishlistItem, updateWishlistItem } from '../services/api';

function WishlistForm({ listId, initialData, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    priority: '',
    link: '',
    imageUrl: '',
    notes: '',
    ...initialData
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        price: initialData.price || '',
        priority: initialData.priority || '',
        link: initialData.link || '',
        imageUrl: initialData.imageUrl || '',
        notes: initialData.notes || '',
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'price' ? parseFloat(value) || '' : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let response;
      if (initialData) {
        response = await updateWishlistItem(initialData._id, {
          ...formData,
          list: listId
        });
      } else {
        const submitData = {
          ...formData,
          list: listId
        };
        response = await createWishlistItem(submitData);
      }
      onSubmit(response);
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        <TextField
          name="title"
          label="Item Name"
          value={formData.title}
          onChange={handleChange}
          required
          fullWidth
          placeholder="What do you want?"
        />
        <TextField
          name="description"
          label="Description"
          value={formData.description}
          onChange={handleChange}
          multiline
          rows={2}
          fullWidth
          placeholder="Add more details about this item"
        />
        <TextField
          name="link"
          label="Product Link"
          value={formData.link}
          onChange={handleChange}
          fullWidth
          placeholder="https://..."
        />
        <TextField
          name="imageUrl"
          label="Image URL"
          value={formData.imageUrl}
          onChange={handleChange}
          fullWidth
          placeholder="https://..."
        />
        <TextField
          name="notes"
          label="Notes"
          value={formData.notes}
          onChange={handleChange}
          multiline
          rows={2}
          fullWidth
          placeholder="Size, color, or other preferences"
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            name="price"
            label="Price"
            type="number"
            value={formData.price}
            onChange={handleChange}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            placeholder="0.00"
          />
          <FormControl sx={{ flex: 1 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              label="Priority"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value={1}>Low</MenuItem>
              <MenuItem value={2}>Normal</MenuItem>
              <MenuItem value={3}>Medium</MenuItem>
              <MenuItem value={4}>High</MenuItem>
              <MenuItem value={5}>Must Have</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            sx={{ minWidth: 140 }}
          >
            {initialData ? 'Save Changes' : 'Add Item'}
          </Button>
        </Box>
      </Box>
    </form>
  );
}

export default WishlistForm;
