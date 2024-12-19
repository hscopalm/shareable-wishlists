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

function WishlistForm({ initialData, onSubmit, isEditing }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    imageUrl: '',
    notes: '',
    price: '',
    priority: 3,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        price: initialData.price || ''
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
      const submissionData = {
        ...formData,
        price: formData.price ? parseFloat(formData.price) : undefined
      };
      console.log('Submitting data:', submissionData);

      if (isEditing) {
        const response = await updateWishlistItem(initialData._id, submissionData);
        console.log('Update response:', response);
      } else {
        const response = await createWishlistItem(submissionData);
        console.log('Create response:', response);
      }
      
      setFormData({
        title: '',
        description: '',
        link: '',
        imageUrl: '',
        notes: '',
        price: '',
        priority: 3,
      });
      onSubmit();
    } catch (error) {
      console.error('Error saving wishlist item:', error);
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
            {isEditing ? 'Update' : 'Add'} Item
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}

export default WishlistForm; 