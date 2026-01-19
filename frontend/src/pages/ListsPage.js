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
  Fade,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as CalendarIcon,
} from '@mui/icons-material';
import { useList } from '../contexts/ListContext';
import { useNavigate } from 'react-router-dom';
import { deleteList, createList, updateList } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

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
        await loadLists();
      } else {
        const newList = await createList(formData);
        await loadLists();
      }

      setFormData({ name: '', description: '', event_date: '' });
      setEditingList(null);
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving list:', error);
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5">My Lists</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateClick}
            >
              Create New List
            </Button>
          </Box>
        </Grid>
        {lists.map((list) => (
          <Grid item xs={12} sm={6} md={4} key={list._id}>
            <Card 
              onClick={() => handleListClick(list)}
              onMouseEnter={() => setHoveredCard(list._id)}
              onMouseLeave={() => setHoveredCard(null)}
              sx={{ 
                cursor: 'pointer',
                position: 'relative',
                '&:hover': { transform: 'translateY(-4px)' },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {list.name}
                </Typography>
                {list.description && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    {list.description}
                  </Typography>
                )}
                {list.event_date && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <CalendarIcon fontSize="small" />
                    {new Date(list.event_date).toLocaleDateString()}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Created {formatDistanceToNow(new Date(list.createdAt))} ago
                </Typography>
                <Fade in={hoveredCard === list._id}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      display: 'flex',
                      gap: 1,
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      borderRadius: '4px',
                      padding: '4px'
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => handleEditClick(e, list)}
                      sx={{ color: 'white' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteList(list, e)}
                      sx={{ color: 'white' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Fade>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingList ? 'Edit List' : 'Create New List'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                autoFocus
                margin="dense"
                label="List Name"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <TextField
                margin="dense"
                label="Description (optional)"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <TextField
                margin="dense"
                label="Event Date (optional)"
                type="date"
                fullWidth
                value={formData.event_date ? new Date(formData.event_date).toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDialogOpen(false);
            }}>
              Cancel
            </Button>
            <Button 
              type="submit"
              variant="contained"
              disabled={!formData.name.trim()}
            >
              {editingList ? 'Save' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default ListsPage; 