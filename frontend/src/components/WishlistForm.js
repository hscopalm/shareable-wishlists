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
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import { createWishlistItem, updateWishlistItem, scrapeUrl } from '../services/api';

function WishlistForm({ listId, initialData, onSubmit }) {
  // Mode: 'choice' | 'manual' | 'link' | 'form'
  const [mode, setMode] = useState(initialData ? 'form' : 'choice');
  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

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
      setMode('form');
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'price' ? parseFloat(value) || '' : value,
    });
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) {
      setFetchError('Please enter a URL');
      return;
    }

    setFetching(true);
    setFetchError('');

    try {
      const metadata = await scrapeUrl(urlInput.trim());
      setFormData({
        ...formData,
        title: metadata.title || formData.title,
        imageUrl: metadata.imageUrl || formData.imageUrl,
        price: metadata.price || formData.price,
        link: metadata.link || urlInput.trim(),
      });
      setMode('form');
    } catch (error) {
      console.error('Error fetching URL:', error);
      setFetchError(
        error.response?.data?.message || 'Failed to fetch product information. You can still add the item manually.'
      );
    } finally {
      setFetching(false);
    }
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

  const handleManualMode = () => {
    setMode('form');
  };

  const handleLinkMode = () => {
    setMode('link');
  };

  const handleBackToChoice = () => {
    setMode('choice');
    setUrlInput('');
    setFetchError('');
  };

  // Choice screen - Manual vs Link
  if (mode === 'choice') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          How would you like to add this item?
        </Typography>
        <Button
          variant="outlined"
          size="large"
          startIcon={<EditIcon />}
          onClick={handleManualMode}
          sx={{ justifyContent: 'flex-start', py: 2, px: 3 }}
        >
          Add Manually
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<LinkIcon />}
          onClick={handleLinkMode}
          sx={{ justifyContent: 'flex-start', py: 2, px: 3 }}
        >
          Add from Link
        </Button>
      </Box>
    );
  }

  // Link input screen
  if (mode === 'link') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body1" color="text.secondary">
          Paste a product URL to auto-fill item details
        </Typography>
        <TextField
          label="Product URL"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          fullWidth
          placeholder="https://amazon.com/..."
          disabled={fetching}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleFetchUrl();
            }
          }}
        />
        {fetchError && (
          <Alert severity="warning" onClose={() => setFetchError('')}>
            {fetchError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="text"
            onClick={handleBackToChoice}
            disabled={fetching}
          >
            Back
          </Button>
          <Button
            variant="text"
            onClick={handleManualMode}
            disabled={fetching}
          >
            Skip, add manually
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            onClick={handleFetchUrl}
            disabled={fetching || !urlInput.trim()}
            startIcon={fetching ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {fetching ? 'Fetching...' : 'Fetch Details'}
          </Button>
        </Box>
      </Box>
    );
  }

  // Form screen (manual entry or pre-populated from URL)
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
          {!initialData && (
            <Button
              variant="text"
              onClick={handleBackToChoice}
            >
              Back
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
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
