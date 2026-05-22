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
    quantity: '',
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
        quantity: initialData.quantity || '',
        link: initialData.link || '',
        imageUrl: initialData.imageUrl || '',
        notes: initialData.notes || '',
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === 'price') nextValue = parseFloat(value) || '';
    if (name === 'quantity') nextValue = value === '' ? '' : (parseInt(value, 10) || '');
    setFormData({ ...formData, [name]: nextValue });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Strip empty quantity so the backend treats it as single-claim (its
      // default). We never want to send `quantity: ''` to the server.
      const { quantity, ...rest } = formData;
      const payload = { ...rest, list: listId };
      if (quantity !== '' && quantity !== null && Number(quantity) > 1) {
        payload.quantity = Number(quantity);
      } else if (initialData && initialData.quantity) {
        // User cleared the field on an existing multi-mode item — explicitly
        // send a falsy quantity so the backend collapses it back to single.
        payload.quantity = null;
      }

      let response;
      if (initialData) {
        response = await updateWishlistItem(initialData._id, payload);
      } else {
        response = await createWishlistItem(payload);
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
          <TextField
            name="quantity"
            label="Quantity"
            type="number"
            value={formData.quantity}
            onChange={handleChange}
            sx={{ flex: 1 }}
            inputProps={{ min: 1, step: 1 }}
            placeholder="1"
            helperText="Leave blank for 1"
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
