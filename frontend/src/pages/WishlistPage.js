import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Fab,
  alpha,
} from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import {
  Add as AddIcon,
  IosShare as ShareIcon,
  Schedule as TimeIcon,
  TrendingUp as PriorityIcon,
  Payments as PriceIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  CalendarMonth as CalendarIcon,
  Inventory2 as EmptyIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import WishlistForm from '../components/WishlistForm';
import WishlistItem from '../components/WishlistItem';
import ShareListDialog from '../components/ShareListDialog';
import { useList } from '../contexts/ListContext';
import { deleteWishlistItem, fetchListItems, claimItem, updateList } from '../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { colors } from '../theme';

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
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', description: '', event_date: '' });

  const closeAllDialogs = useCallback(() => {
    setOpenAddDialog(false);
    setOpenShareDialog(false);
    setOpenEditDialog(false);
    setEditingItem(null);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (openAddDialog || openShareDialog || openEditDialog) {
        closeAllDialogs();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [openAddDialog, openShareDialog, openEditDialog, closeAllDialogs]);

  const openAddDialogWithHistory = useCallback((item = null) => {
    window.history.pushState({ dialog: 'add' }, '');
    setEditingItem(item);
    setOpenAddDialog(true);
  }, []);

  const openShareDialogWithHistory = useCallback(() => {
    window.history.pushState({ dialog: 'share' }, '');
    setOpenShareDialog(true);
  }, []);

  const closeAddDialog = useCallback(() => {
    if (openAddDialog) {
      window.history.back();
    }
  }, [openAddDialog]);

  const closeShareDialog = useCallback(() => {
    if (openShareDialog) {
      window.history.back();
    }
  }, [openShareDialog]);

  const openEditDialogWithHistory = useCallback(() => {
    if (currentList) {
      setEditFormData({
        name: currentList.name || '',
        description: currentList.description || '',
        event_date: currentList.event_date || ''
      });
      window.history.pushState({ dialog: 'edit' }, '');
      setOpenEditDialog(true);
    }
  }, [currentList]);

  const closeEditDialog = useCallback(() => {
    if (openEditDialog) {
      window.history.back();
    }
  }, [openEditDialog]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim() || !currentList?._id) return;

    try {
      await updateList(currentList._id, editFormData);
      closeEditDialog();
      await loadItems();
    } catch (error) {
      console.error('Error updating list:', error);
    }
  };

  const loadItems = async (redirectOnError = false) => {
    try {
      const data = await fetchListItems(listId);
      setItems(data.items || []);
      setCurrentList(data.list, data.isShared);
    } catch (error) {
      console.error('Error loading wishlist items:', error);
      if (redirectOnError) {
        navigate(isSharedList ? '/shared' : '/');
      }
    }
  };

  useEffect(() => {
    if (listId) {
      loadItems(true);
    }

    return () => {
      if (isSharedList) {
        setCurrentList(null, false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  const handleEditItem = (item) => {
    openAddDialogWithHistory(item);
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
            backgroundColor: isActive ? alpha(colors.primary, 0.15) : 'transparent',
            border: `1px solid ${isActive ? alpha(colors.primary, 0.3) : 'transparent'}`,
            borderRadius: '10px',
            transition: 'all 0.2s ease-in-out',
            px: 1.5,
            '&:hover': {
              backgroundColor: alpha(colors.primary, 0.1),
            },
          }}
        >
          <Icon
            sx={{
              color: isActive ? colors.primary : colors.text.secondary,
              fontSize: 20,
            }}
          />
          {isActive && (
            sortDirection === 'asc' ?
              <ArrowUpIcon sx={{ color: colors.primary, fontSize: 16, ml: 0.25 }} /> :
              <ArrowDownIcon sx={{ color: colors.primary, fontSize: 16, ml: 0.25 }} />
          )}
        </IconButton>
      </Tooltip>
    );
  };

  const handleClaimItem = async (item) => {
    try {
      const updatedItem = await claimItem(listId, item._id);
      setItems(prevItems =>
        prevItems.map(i =>
          i._id === item._id ? { ...i, status: updatedItem.status } : i
        )
      );
    } catch (error) {
      console.error('Error claiming item:', error);
    }
  };

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          position: 'relative',
          mb: 4,
          p: { xs: 3, sm: 4 },
          borderRadius: '20px',
          background: `linear-gradient(135deg, ${alpha(colors.primary, 0.1)} 0%, ${alpha(colors.secondary, 0.05)} 100%)`,
          border: `1px solid ${colors.border}`,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '40%',
            height: '100%',
            background: `radial-gradient(circle at 100% 0%, ${alpha(colors.primary, 0.15)} 0%, transparent 70%)`,
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.75rem', sm: '2.25rem' },
              pb: 0.5,
              background: `linear-gradient(135deg, ${colors.text.primary} 0%, ${colors.primary} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {currentList?.name}
          </Typography>
          {!isSharedList && (
            <Tooltip title="Edit list details">
              <IconButton
                onClick={openEditDialogWithHistory}
                sx={{
                  backgroundColor: alpha(colors.primary, 0.1),
                  border: `1px solid ${alpha(colors.primary, 0.2)}`,
                  '&:hover': {
                    backgroundColor: alpha(colors.primary, 0.2),
                  },
                }}
              >
                <EditIcon sx={{ color: colors.primary }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {currentList?.user && (
          <Box display="flex" alignItems="center">
            <Avatar
              src={currentList.user.picture}
              alt={currentList.user.name}
              sx={{
                width: 44,
                height: 44,
                mr: 1.5,
                border: `2px solid ${colors.primary}`,
              }}
            >
              {currentList.user.name?.[0] || '?'}
            </Avatar>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, lineHeight: 1.2 }}
              >
                {currentList.user.name || 'Unknown User'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                List Owner
              </Typography>
            </Box>
          </Box>
        )}

        {currentList?.description && (
          <Typography
            variant="body1"
            sx={{
              color: colors.text.secondary,
              mt: 2.5,
              pl: 2,
              borderLeft: `3px solid ${colors.primary}`,
              fontStyle: 'italic',
            }}
          >
            {currentList.description}
          </Typography>
        )}

        {currentList?.event_date && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mt: 3,
              px: 2,
              py: 1,
              borderRadius: '10px',
              backgroundColor: alpha(colors.primary, 0.1),
              border: `1px solid ${alpha(colors.primary, 0.2)}`,
            }}
          >
            <CalendarIcon sx={{ color: colors.primary, fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {new Date(currentList.event_date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Action Bar */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {!isSharedList && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openAddDialogWithHistory()}
            sx={{ minWidth: 'fit-content' }}
          >
            Add Item
          </Button>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 0.75,
            backgroundColor: alpha(colors.background.elevated, 0.5),
            borderRadius: '14px',
            border: `1px solid ${colors.border}`,
            ml: 'auto',
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1, display: { xs: 'none', sm: 'block' } }}
          >
            Sort:
          </Typography>
          <SortButton field="createdAt" icon={TimeIcon} label="Date Added" />
          <SortButton field="priority" icon={PriorityIcon} label="Priority" />
          <SortButton field="price" icon={PriceIcon} label="Price" />
        </Box>
      </Box>

      {/* Items Grid */}
      <Box sx={{ width: '100%' }}>
        {items.length > 0 ? (
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
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              px: 4,
              borderRadius: '20px',
              backgroundColor: alpha(colors.background.elevated, 0.3),
              border: `1px dashed ${colors.border}`,
            }}
          >
            <EmptyIcon
              sx={{
                fontSize: 64,
                color: colors.text.muted,
                mb: 2,
                opacity: 0.5,
              }}
            />
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 1, fontWeight: 500 }}
            >
              No items yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {isSharedList
                ? "This wishlist is empty"
                : "Start adding items to your wishlist"
              }
            </Typography>
            {!isSharedList && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => openAddDialogWithHistory()}
              >
                Add your first item
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Share FAB */}
      {!isSharedList && (
        <Fab
          onClick={openShareDialogWithHistory}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
            boxShadow: `0 8px 30px ${alpha(colors.primary, 0.4)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.secondary} 100%)`,
              transform: 'scale(1.05)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          <ShareIcon />
        </Fab>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={closeAddDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {editingItem ? 'Edit Item' : 'Add New Item'}
        </DialogTitle>
        <DialogContent>
          <WishlistForm
            listId={currentList?._id}
            initialData={editingItem}
            onSubmit={() => {
              closeAddDialog();
              loadItems();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <ShareListDialog
        open={openShareDialog}
        onClose={closeShareDialog}
        listId={currentList?._id}
      />

      {/* Edit List Dialog */}
      <Dialog
        open={openEditDialog}
        onClose={closeEditDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '20px' },
        }}
      >
        <form onSubmit={handleEditSubmit}>
          <DialogTitle>Edit List</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                autoFocus
                label="List Name"
                fullWidth
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
                placeholder="e.g., Birthday Wishlist"
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="What's this list for?"
              />
              <TextField
                label="Event Date"
                type="date"
                fullWidth
                value={editFormData.event_date ? new Date(editFormData.event_date).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditFormData({ ...editFormData, event_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeEditDialog();
              }}
              sx={{ color: colors.text.secondary }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!editFormData.name.trim()}
            >
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default WishlistPage;
