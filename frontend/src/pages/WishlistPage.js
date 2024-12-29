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
import {
  Add as AddIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import WishlistForm from '../components/WishlistForm';
import WishlistItem from '../components/WishlistItem';
import ShareListDialog from '../components/ShareListDialog';
import { useList } from '../contexts/ListContext';
import { deleteWishlistItem, fetchListItems } from '../services/api';
import { useParams } from 'react-router-dom';

function WishlistPage() {
  const { id: listId } = useParams();
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
      }
    };

    if (listId) {
      loadListData();
    }
  }, [listId, setCurrentList]);

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
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" gutterBottom>
              {currentList?.name}
            </Typography>
            
            {currentList?.description && (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ mb: 2 }}
              >
                {currentList.description}
              </Typography>
            )}

            {isSharedList && currentList?.owner && (
              <Box 
                display="flex" 
                alignItems="center" 
                sx={{ 
                  mt: 1,
                  p: 1.5,
                  borderRadius: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                }}
              >
                <Avatar
                  src={currentList.owner.picture}
                  alt={currentList.owner.name}
                  sx={{ 
                    width: 40, 
                    height: 40,
                    mr: 2,
                    border: '2px solid white',
                    boxShadow: 1
                  }}
                >
                  {currentList.owner.name[0]}
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    List Owner
                  </Typography>
                  <Typography variant="body1">
                    {currentList.owner.name}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>

          {!isSharedList && (
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => setOpenAddDialog(true)}
            >
              Add Item
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={item._id}>
            <WishlistItem 
              item={item} 
              onEdit={!isSharedList ? handleEditItem : undefined}
              onDelete={!isSharedList ? handleDeleteItem : undefined}
            />
          </Grid>
        ))}
      </Grid>

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