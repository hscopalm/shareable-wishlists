import React, { useState, useEffect } from 'react';
import {
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  SpeedDial,
  SpeedDialIcon,
  Paper,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Share as ShareIcon,
  AccessTime as TimeIcon,
  PriorityHigh as PriorityIcon,
  AttachMoney as PriceIcon,
} from '@mui/icons-material';
import WishlistForm from '../components/WishlistForm';
import WishlistItem from '../components/WishlistItem';
import ShareListDialog from '../components/ShareListDialog';
import { fetchWishlistItems } from '../services/api';

function WishlistPage() {
  const [items, setItems] = useState([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openShareDialog, setOpenShareDialog] = useState(false);
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
    </Tooltip>
  );

  const handleStatusUpdate = (itemId, status) => {
    setItems(prevItems => 
      prevItems.map(item => {
        if (item._id === itemId) {
          const existingStatuses = item.statuses || [];
          const otherStatuses = existingStatuses.filter(s => s.user._id !== status.user._id);
          return {
            ...item,
            statuses: [...otherStatuses, status]
          };
        }
        return item;
      })
    );
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setOpenAddDialog(true)}
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
              <Box sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
                  Sort by:
                </Typography>
                <SortButton field="createdAt" icon={TimeIcon} label="Date" />
                <SortButton field="priority" icon={PriorityIcon} label="Priority" />
                <SortButton field="price" icon={PriceIcon} label="Price" />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Grid container spacing={2}>
        {getSortedItems().map((item) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={item._id}>
            <WishlistItem 
              item={item} 
              onUpdate={loadItems}
              onStatusUpdate={handleStatusUpdate} 
            />
          </Grid>
        ))}
      </Grid>

      <SpeedDial
        ariaLabel="share"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<ShareIcon />}
        onClick={() => setOpenShareDialog(true)}
      />

      <Dialog 
        open={openAddDialog} 
        onClose={() => setOpenAddDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Wishlist Item</DialogTitle>
        <DialogContent>
          <WishlistForm
            onSubmit={() => {
              setOpenAddDialog(false);
              loadItems();
            }}
          />
        </DialogContent>
      </Dialog>

      <ShareListDialog 
        open={openShareDialog}
        onClose={() => setOpenShareDialog(false)}
      />
    </>
  );
}

export default WishlistPage; 