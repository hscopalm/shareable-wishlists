import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  KeyboardArrowDown as ArrowIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  List as ListIcon,
} from '@mui/icons-material';
import { useList } from '../contexts/ListContext';
import { createList, updateList, deleteList } from '../services/api';
import { useNavigate } from 'react-router-dom';

function ListSelector() {
  const navigate = useNavigate();
  const { lists, currentList, setCurrentList, loadLists, isSharedList } = useList();
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  // Don't render the selector if viewing a shared list
  if (isSharedList) {
    return null;
  }

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleListSelect = (list) => {
    setCurrentList(list);
    navigate(`/list/${list._id}`);
    handleClose();
  };

  const handleAddClick = () => {
    setEditingList(null);
    setFormData({ name: '', description: '' });
    setDialogOpen(true);
    handleClose();
  };

  const handleEditClick = (list, event) => {
    event.stopPropagation();
    setEditingList(list);
    setFormData({ name: list.name, description: list.description || '' });
    setDialogOpen(true);
    handleClose();
  };

  const handleDeleteClick = async (list, event) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this list?')) {
      try {
        await deleteList(list._id);
        await loadLists();
      } catch (error) {
        console.error('Error deleting list:', error);
      }
    }
    handleClose();
  };

  const handleSubmit = async () => {
    try {
      if (editingList) {
        await updateList(editingList._id, formData);
      } else {
        await createList(formData);
      }
      await loadLists();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving list:', error);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        endIcon={<ArrowIcon />}
        sx={{ mb: 2 }}
      >
        {currentList?.name || 'Select List'}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        {lists.map((list) => (
          <MenuItem 
            key={list._id} 
            onClick={() => handleListSelect(list)}
            selected={currentList?._id === list._id}
          >
            <ListItemIcon>
              <ListIcon />
            </ListItemIcon>
            <ListItemText primary={list.name} />
            {!list.isDefault && (
              <Box sx={{ ml: 1 }}>
                <IconButton
                  size="small"
                  onClick={(e) => handleEditClick(list, e)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => handleDeleteClick(list, e)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </MenuItem>
        ))}
        <MenuItem onClick={handleAddClick}>
          <ListItemIcon>
            <AddIcon />
          </ListItemIcon>
          <ListItemText primary="Create New List" />
        </MenuItem>
      </Menu>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          {editingList ? 'Edit List' : 'Create New List'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="List Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingList ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ListSelector; 