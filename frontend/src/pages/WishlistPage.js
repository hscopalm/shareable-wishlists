import React, { useState, useEffect } from 'react';
import {
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  SpeedDial,
  Typography,
  Avatar,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import {
  Add as AddIcon,
  Share as ShareIcon,
  AccessTime as TimeIcon,
  PriorityHigh as PriorityIcon,
  AttachMoney as PriceIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import WishlistForm from '../components/WishlistForm';
import WishlistItem from '../components/WishlistItem';
import ShareListDialog from '../components/ShareListDialog';
import { useList } from '../contexts/ListContext';
import { deleteWishlistItem, fetchListItems, claimItem } from '../services/api';
import { useParams, useNavigate } from 'react-router-dom';

function WishlistPage() {
  const { id: listId } = useParams();
  const navigate = useNavigate();
  const { currentList, setCurrentList, isSharedList } = useList();
  const [items, setItems] = useState([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openShareDialog, setOpenShareDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    const loadListData = async () => {
      try {
        const data = await fetchListItems(listId);
        setCurrentList(data.list, data.isShared);
        setItems(data.items || []);
      } catch (error) {
        console.error('Error loading list:', error);
        // Redirect to appropriate page on error
        navigate(isSharedList ? '/shared' : '/');
      }
    };

    if (listId) {
      loadListData();
    }

    // Cleanup shared list state
    return () => {
      if (isSharedList) {
        setCurrentList(null, false);
      }
    };
  }, [listId, setCurrentList, navigate, isSharedList]);

  const loadItems = async () => {
    try {
      const data = await fetchListItems(listId);
      setItems(data.items || []);
      setCurrentList(data.list, data.isShared);
    } catch (error) {
      console.error('Error loading wishlist items:', error);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setOpenAddDialog(true);
  };

  const handleDeleteItem = async (item) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteWishlistItem(item._id);
        await loadItems();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
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
          comparison = (b.priority || 0) - (a.priority || 0);
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

  const SortButton = ({ field, icon: Icon, label }) => {
    const isActive = sortBy === field;
    return (
      <Tooltip title={`Sort by ${label}`}>
        <IconButton
          onClick={() => handleSort(field)}
          sx={{
            backgroundColor: isActive ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
            borderRadius: '8px',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: isActive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            },
            mr: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Icon
              sx={{
                color: isActive ? 'primary.main' : 'text.secondary',
                mr: 0.5
              }}
            />
            {isActive && (
              sortDirection === 'asc' ? 
                <ArrowUpIcon sx={{ color: 'primary.main', fontSize: '1rem' }} /> :
                <ArrowDownIcon sx={{ color: 'primary.main', fontSize: '1rem' }} />
            )}
          </Box>
        </IconButton>
      </Tooltip>
    );
  };

  const handleClaimItem = async (item) => {
    try {
      const updatedItem = await claimItem(listId, item._id);
      // Update the items list with the new claim status
      setItems(prevItems => 
        prevItems.map(i => 
          i._id === item._id ? { ...i, status: updatedItem.status } : i
        )
      );
    } catch (error) {
      console.error('Error claiming item:', error);
      // You might want to show an error message to the user here
    }
  };

  return (
    <Box>
      <Box 
        mb={4} 
        sx={{
          backgroundColor: 'rgba(46, 52, 64, 0.3)',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{
            fontWeight: 600,
            color: 'primary.main',
            mb: 2
          }}
        >
          {currentList?.name}
        </Typography>
        
        {currentList?.user && (
          <Box 
            display="flex" 
            alignItems="center" 
            mb={currentList?.description ? 3 : 0}
          >
            <Avatar 
              src={currentList.user.picture} 
              alt={currentList.user.name}
              sx={{ 
                mr: 2, 
                width: 36, 
                height: 36,
                border: '2px solid',
                borderColor: 'primary.main',
              }}
            >
              {currentList.user.name?.[0] || '?'}
            </Avatar>
            <Box>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 500,
                  color: 'text.primary',
                }}
              >
                {currentList.user.name || 'Unknown User'}
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary"
              >
                List Owner
              </Typography>
            </Box>
          </Box>
        )}
        
        {currentList?.description && (
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              mt: 2,
              borderLeft: '2px solid',
              borderColor: 'primary.main',
              pl: 2,
            }}
          >
            {currentList.description}
          </Typography>
        )}
      </Box>

      <Box 
        sx={{ 
          mb: 3, 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap'
        }}
      >
        {!isSharedList && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAddDialog(true)}
            color="primary"
            sx={{ minWidth: 'fit-content' }}
          >
            Add Item
          </Button>
        )}

        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: 1,
            backgroundColor: 'rgba(46, 52, 64, 0.3)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            ml: 'auto', // This pushes the sort controls to the right
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
            Sort by:
          </Typography>
          <SortButton field="createdAt" icon={TimeIcon} label="Date Added" />
          <SortButton field="priority" icon={PriorityIcon} label="Priority" />
          <SortButton field="price" icon={PriceIcon} label="Price" />
        </Paper>
      </Box>

      <Box sx={{ width: '100%' }}>
        <Masonry
          columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
          spacing={2}
          defaultHeight={450}
          defaultColumns={4}
          defaultSpacing={2}
        >
          {getSortedItems().map((item) => (
            <WishlistItem 
              key={item._id}
              item={item} 
              onEdit={!isSharedList ? handleEditItem : undefined}
              onDelete={!isSharedList ? handleDeleteItem : undefined}
              onClaim={isSharedList ? handleClaimItem : undefined}
              isSharedList={isSharedList}
            />
          ))}
        </Masonry>
        {items.length === 0 && (
          <Typography color="text.secondary" align="center">
            No items in this wishlist
          </Typography>
        )}
      </Box>

      {!isSharedList && (
        <SpeedDial
          ariaLabel="share"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<ShareIcon />}
          onClick={() => setOpenShareDialog(true)}
        />
      )}

      <Dialog 
        open={openAddDialog} 
        onClose={() => {
          setOpenAddDialog(false);
          setEditingItem(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingItem ? 'Edit Item' : 'Add New Item'}
        </DialogTitle>
        <DialogContent>
          <WishlistForm
            listId={currentList?._id}
            initialData={editingItem}
            onSubmit={(savedItem) => {
              console.log('Item saved:', savedItem);
              setOpenAddDialog(false);
              setEditingItem(null);
              loadItems();
            }}
          />
        </DialogContent>
      </Dialog>

      <ShareListDialog 
        open={openShareDialog}
        onClose={() => setOpenShareDialog(false)}
        listId={currentList?._id}
      />
    </Box>
  );
}

export default WishlistPage; 