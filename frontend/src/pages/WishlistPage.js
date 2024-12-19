import React, { useState, useEffect } from 'react';
import {
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  AccessTime as TimeIcon,
  PriorityHigh as PriorityIcon,
  AttachMoney as PriceIcon,
} from '@mui/icons-material';
import WishlistForm from '../components/WishlistForm';
import WishlistItem from '../components/WishlistItem';
import { fetchWishlistItems } from '../services/api';

function WishlistPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await fetchWishlistItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading wishlist items:', error);
    }
  };

  const handleSort = (field) => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const getSortedItems = () => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'priority':
          comparison = b.priority - a.priority;
          break;
        case 'price':
          comparison = (b.price || 0) - (a.price || 0);
          break;
        case 'createdAt':
          comparison = new Date(b.createdAt) - new Date(a.createdAt);
          break;
        default:
          return 0;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  };

  const SortButton = ({ field, icon: Icon, label }) => (
    <Tooltip title={`Sort by ${label}`}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <IconButton
          onClick={() => handleSort(field)}
          sx={{
            backgroundColor: sortBy === field ? 'rgba(33, 150, 243, 0.1)' : 'transparent',
            borderRadius: '12px',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(33, 150, 243, 0.2)',
            },
          }}
        >
          <Icon
            sx={{
              color: sortBy === field ? '#2196F3' : 'text.secondary',
              transition: 'transform 0.2s ease-in-out',
              transform: sortBy === field && sortDirection === 'asc' ? 'rotate(180deg)' : 'none',
            }}
          />
        </IconButton>
      </Box>
    </Tooltip>
  );

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setOpen(true)}
              startIcon={<AddIcon />}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                px: 3,
                py: 1,
                backgroundColor: '#4CAF50',
                '&:hover': {
                  backgroundColor: '#45a049',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 5px 15px rgba(76, 175, 80, 0.3)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              Add New Item
            </Button>
          </Grid>
          <Grid item>
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                gap: 1,
                p: 0.5,
                backgroundColor: 'rgba(46, 52, 64, 0.3)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <SortButton field="createdAt" icon={TimeIcon} label="Date" />
              <SortButton field="priority" icon={PriorityIcon} label="Priority" />
              <SortButton field="price" icon={PriceIcon} label="Price" />
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Grid container spacing={2}>
        {getSortedItems().map((item) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={item._id}>
            <WishlistItem item={item} onUpdate={loadItems} />
          </Grid>
        ))}
      </Grid>

      <Dialog 
        open={open} 
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #3A3F4B' }}>
          Add New Wishlist Item
        </DialogTitle>
        <DialogContent>
          <WishlistForm
            onSubmit={() => {
              setOpen(false);
              loadItems();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WishlistPage; 