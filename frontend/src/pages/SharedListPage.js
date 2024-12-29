import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Grid,
  Typography,
  Box,
  Paper,
  IconButton,
  Tooltip,
  Avatar,
  Button,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AccessTime as TimeIcon,
  PriorityHigh as PriorityIcon,
  AttachMoney as PriceIcon,
} from '@mui/icons-material';
import WishlistItem from '../components/WishlistItem';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useList } from '../contexts/ListContext';

function SharedListPage() {
  const { user } = useAuth();
  const { setIsSharedList } = useList();
  const [items, setItems] = useState([]);
  const [owner, setOwner] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const { userId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    setIsSharedList(true);
    return () => setIsSharedList(false);
  }, [setIsSharedList]);

  const loadSharedList = useCallback(async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/share/shared-list/${userId}`, {
        withCredentials: true
      });
      setItems(response.data.items);
      setOwner(response.data.owner);
    } catch (error) {
      console.error('Error loading shared list:', error);
      if (error.response?.status === 404 || error.response?.status === 403) {
        navigate('/shared');
      }
    }
  }, [userId, navigate]);

  useEffect(() => {
    loadSharedList();
  }, [loadSharedList]);

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

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/shared')}
              sx={{ color: 'text.secondary' }}
            >
              Back to Shared Lists
            </Button>
          </Grid>
        </Grid>
        {owner && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, mb: 3 }}>
            <Avatar
              src={owner.picture}
              alt={owner.name}
              sx={{ width: 48, height: 48 }}
            />
            <Typography variant="h5">
              {owner.name}'s Wishlist
            </Typography>
          </Box>
        )}
        <Grid container spacing={2} alignItems="center" justifyContent="flex-end">
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
              onUpdate={loadSharedList}
            />
          </Grid>
        ))}
        {items.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center">
              No items in this wishlist
            </Typography>
          </Grid>
        )}
      </Grid>
    </>
  );
}

export default SharedListPage; 