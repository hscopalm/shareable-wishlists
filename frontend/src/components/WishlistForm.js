import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DialogActions,
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
      <Stack spacing={2} sx={{ p: 2, minWidth: '300px' }}>
        <TextField
          name="title"
          label="Title"
          value={formData.title}
          onChange={handleChange}
          required
          fullWidth
        />
        <TextField
          name="description"
          label="Description"
          value={formData.description}
          onChange={handleChange}
          multiline
          rows={2}
          fullWidth
        />
        <TextField
          name="link"
          label="Link"
          value={formData.link}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          name="imageUrl"
          label="Image URL"
          value={formData.imageUrl}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          name="notes"
          label="Notes"
          value={formData.notes}
          onChange={handleChange}
          multiline
          rows={2}
          fullWidth
        />
        <TextField
          name="price"
          label="Approximate Price"
          type="number"
          value={formData.price}
          onChange={handleChange}
          fullWidth
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
        />
        <FormControl fullWidth>
          <InputLabel>Priority</InputLabel>
          <Select
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            label="Priority"
          >
            <MenuItem value={1}>Very Low</MenuItem>
            <MenuItem value={2}>Low</MenuItem>
            <MenuItem value={3}>Medium</MenuItem>
            <MenuItem value={4}>High</MenuItem>
            <MenuItem value={5}>Very High</MenuItem>
          </Select>
        </FormControl>
        <DialogActions>
          <Button type="submit" variant="contained" color="primary">
            {initialData ? 'Update' : 'Add'} Item
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}

export default WishlistForm; 