import React, { useState } from 'react';
import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarMonth as CalendarIcon,
  Inventory2 as EmptyIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useList } from '../contexts/ListContext';
import { useNavigate } from 'react-router-dom';
import { deleteList, createList, updateList } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { colors } from '../theme';

function ListsPage() {
  const { lists, refreshLists: loadLists, setCurrentList } = useList();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', event_date: '' });
  const [hoveredCard, setHoveredCard] = useState(null);

  const handleListClick = (list) => {
    setCurrentList(list);
    navigate(`/list/${list._id}`);
  };

  const handleCreateClick = () => {
    setEditingList(null);
    setFormData({ name: '', description: '', event_date: '' });
    setDialogOpen(true);
  };

  const handleEditClick = (event, list) => {
    event.stopPropagation();
    setEditingList(list);
    setFormData({
      name: list.name,
      description: list.description || '',
      event_date: list.event_date || ''
    });
    setDialogOpen(true);
  };

  const handleDeleteList = async (list, event) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this list?')) {
      try {
        await deleteList(list._id);
        await loadLists();
      } catch (error) {
        console.error('Error deleting list:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name.trim()) {
        return;
      }

      if (editingList) {
        await updateList(editingList._id, formData);
      } else {
        await createList(formData);
      }
      await loadLists();

      setFormData({ name: '', description: '', event_date: '' });
      setEditingList(null);
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving list:', error);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.text.primary} 0%, ${colors.primary} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            My Lists
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {lists.length} {lists.length === 1 ? 'wishlist' : 'wishlists'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
        >
          Create List
        </Button>
      </Box>

      {/* Lists Grid */}
      {lists.length > 0 ? (
        <Grid container spacing={3}>
          {lists.map((list) => (
            <Grid item xs={12} sm={6} md={4} key={list._id}>
              <Card
                onClick={() => handleListClick(list)}
                onMouseEnter={() => setHoveredCard(list._id)}
                onMouseLeave={() => setHoveredCard(null)}
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    '& .card-arrow': {
                      opacity: 1,
                      transform: 'translateX(0)',
                    },
                  },
                }}
              >
                <CardContent sx={{ flex: 1, p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        pr: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      {list.name}
                    </Typography>
                    <ArrowIcon
                      className="card-arrow"
                      sx={{
                        color: colors.primary,
                        opacity: 0,
                        transform: 'translateX(-8px)',
                        transition: 'all 0.2s ease-in-out',
                      }}
                    />
                  </Box>

                  {list.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {list.description}
                    </Typography>
                  )}

                  {list.event_date && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px',
                        backgroundColor: alpha(colors.primary, 0.1),
                        border: `1px solid ${alpha(colors.primary, 0.2)}`,
                      }}
                    >
                      <CalendarIcon sx={{ fontSize: 16, color: colors.primary }} />
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        {new Date(list.event_date.split('T')[0] + 'T12:00:00').toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: list.event_date ? 1.5 : 0 }}
                  >
                    Created {formatDistanceToNow(new Date(list.createdAt))} ago
                  </Typography>

                  {/* Action Buttons */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      display: 'flex',
                      gap: 0.5,
                      opacity: hoveredCard === list._id ? 1 : 0,
                      transform: hoveredCard === list._id ? 'translateY(0)' : 'translateY(-4px)',
                      transition: 'all 0.2s ease-in-out',
                      backgroundColor: colors.background.elevated,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      padding: '4px',
                      boxShadow: `0 4px 20px ${alpha('#000', 0.3)}`,
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => handleEditClick(e, list)}
                      sx={{
                        color: colors.primary,
                        '&:hover': {
                          backgroundColor: alpha(colors.primary, 0.15),
                        },
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteList(list, e)}
                      sx={{
                        color: colors.error,
                        '&:hover': {
                          backgroundColor: alpha(colors.error, 0.15),
                        },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 10,
            px: 4,
            borderRadius: '20px',
            backgroundColor: alpha(colors.background.elevated, 0.3),
            border: `1px dashed ${colors.border}`,
          }}
        >
          <EmptyIcon
            sx={{
              fontSize: 72,
              color: colors.text.muted,
              mb: 3,
              opacity: 0.5,
            }}
          />
          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            No wishlists yet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
            Create your first wishlist and start adding items
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={handleCreateClick}
          >
            Create your first list
          </Button>
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '20px' },
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingList ? 'Edit List' : 'Create New List'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                autoFocus
                label="List Name"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Birthday Wishlist"
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What's this list for?"
              />
              <TextField
                label="Event Date"
                type="date"
                fullWidth
                value={formData.event_date ? new Date(formData.event_date).toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDialogOpen(false);
              }}
              sx={{ color: colors.text.secondary }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!formData.name.trim()}
            >
              {editingList ? 'Save Changes' : 'Create List'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default ListsPage;
