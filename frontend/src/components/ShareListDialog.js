import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  ListItemAvatar,
  Avatar,
  Box,
  Chip,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { shareList, getSharedUsers, unshareList } from '../services/api';
import { useList } from '../contexts/ListContext';

function ShareListDialog({ open, onClose, listId }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sharedUsers, setSharedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { currentList } = useList();

  useEffect(() => {
    if (open && !listId) {
      console.error('ShareListDialog opened without a listId');
      setError('Unable to load sharing information');
      onClose();
    }
  }, [open, listId, onClose]);

  const handleShare = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      
      if (!email.trim()) {
        setError('Please enter an email address');
        return;
      }

      const result = await shareList(currentList._id, email.trim());
      await loadSharedUsers();
      setSuccess(
        result.isPending 
          ? 'Invitation sent! They will get access when they sign up.' 
          : 'List shared successfully'
      );
      setEmail('');

    } catch (error) {
      console.error('Share error:', error);
      setError(
        error.response?.data?.message || 
        'Error sharing list. Please try again.'
      );
    }
  };

  const loadSharedUsers = useCallback(async () => {
    if (!listId) {
      console.log('No listId provided to loadSharedUsers');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Fetching shared users for list:', listId);
      const data = await getSharedUsers(listId);
      console.log('Received shared users:', data);
      setSharedUsers(data);
    } catch (error) {
      console.error('Error loading shared users:', error);
      setError('Failed to load shared users');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    if (open) {
      console.log('ShareListDialog opened, loading shared users');
      loadSharedUsers();
    }
  }, [open, loadSharedUsers]);

  const handleUnshare = async (userId) => {
    try {
      await unshareList(currentList._id, userId);
      setSharedUsers(prev => prev.filter(user => user.id !== userId));
    } catch (error) {
      setError('Error removing share');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Share Your List</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        <form onSubmit={handleShare}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            helperText="Enter the email address to share with"
            required
          />
          <Box sx={{ mt: 1, mb: 3 }}>
            <Button type="submit" variant="contained" color="primary">
              Share
            </Button>
          </Box>
        </form>

        <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
          Shared With
        </Typography>
        <List>
          {sharedUsers.map((share) => (
            <ListItem key={share.id}>
              <ListItemAvatar>
                {share.isPending ? (
                  <Avatar sx={{ bgcolor: 'grey.400' }}>
                    {share.email[0].toUpperCase()}
                  </Avatar>
                ) : share.picture ? (
                  <Avatar src={share.picture} />
                ) : (
                  <Avatar>{(share.name || share.email)[0].toUpperCase()}</Avatar>
                )}
              </ListItemAvatar>
              <ListItemText
                primary={share.name || share.email}
                secondary={
                  <>
                    {share.isPending && (
                      <Chip
                        size="small"
                        label="Invitation Pending"
                        color="warning"
                        sx={{ mr: 1 }}
                      />
                    )}
                    {share.lastViewed ? 
                      `Last viewed ${format(new Date(share.lastViewed), 'MMM d, yyyy h:mm a')}` : 
                      'Never viewed'
                    }
                  </>
                }
              />
              <ListItemSecondaryAction>
                <IconButton 
                  edge="end" 
                  onClick={() => handleUnshare(share.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
          {(!sharedUsers || sharedUsers.length === 0) && (
            <ListItem>
              <ListItemText
                secondary="No one has been given access to your list yet"
                sx={{ textAlign: 'center', color: 'text.secondary' }}
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ShareListDialog; 