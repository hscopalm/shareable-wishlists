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
} from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import {
  Add as AddIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import WishlistForm from '../components/WishlistForm';
import WishlistItem from '../components/WishlistItem';
import ShareListDialog from '../components/ShareListDialog';
import { useList } from '../contexts/ListContext';
import { deleteWishlistItem, fetchListItems } from '../services/api';
import { useParams, useNavigate } from 'react-router-dom';

function WishlistPage() {
  const { id: listId } = useParams();
  const navigate = useNavigate();
  const { currentList, setCurrentList, isSharedList } = useList();
  const [items, setItems] = useState([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openShareDialog, setOpenShareDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {currentList?.name}
          </Typography>
          
          {currentList?.user && (
            <Box display="flex" alignItems="center" mb={2}>
              <Avatar 
                src={currentList.user.picture} 
                alt={currentList.user.name}
                sx={{ mr: 1, width: 32, height: 32 }}
              >
                {currentList.user.name?.[0] || '?'}
              </Avatar>
              <Typography variant="subtitle1" color="text.secondary">
                {currentList.user.name || 'Unknown User'}'s List
              </Typography>
            </Box>
          )}
          
          {currentList?.description && (
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {currentList.description}
            </Typography>
          )}
        </Box>

        <Box>
          {!isSharedList && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenAddDialog(true)}
              color="primary"
            >
              Add Item
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ width: '100%' }}>
        <Masonry
          columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
          spacing={2}
          defaultHeight={450}
          defaultColumns={4}
          defaultSpacing={2}
        >
          {items.map((item) => (
            <WishlistItem 
              key={item._id}
              item={item} 
              onEdit={!isSharedList ? handleEditItem : undefined}
              onDelete={!isSharedList ? handleDeleteItem : undefined}
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