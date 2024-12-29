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
} from '@mui/icons-material';
import { useList } from '../contexts/ListContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { deleteList, createList, updateList } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

function ListsPage() {
  const { lists, refreshLists: loadLists, setCurrentList } = useList();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [hoveredCard, setHoveredCard] = useState(null);

  if (!user) {
    return <Navigate to="/login" />;
  }

  const handleListClick = (list) => {
    setCurrentList(list);
    navigate(`/list/${list._id}`);
  };

  const handleCreateClick = () => {
    setEditingList(null);
    setFormData({ name: '', description: '' });
    setDialogOpen(true);
  };

  const handleEditClick = (event, list) => {
    event.stopPropagation();
    console.log('Editing list:', list);
    setEditingList(list);
    setFormData({
      name: list.name,
      description: list.description || ''
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
        console.log('Updating list:', { id: editingList._id, data: formData });
        const updatedList = await updateList(editingList._id, formData);
        console.log('List updated:', updatedList);
        
        await loadLists();
      } else {
        const newList = await createList(formData);
        await loadLists();
      }

      setFormData({ name: '', description: '' });
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
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
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