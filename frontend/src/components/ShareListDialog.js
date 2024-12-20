import React, { useState } from 'react';
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
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';

function ShareListDialog({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sharedUsers, setSharedUsers] = useState([]);
  const [pendingShares, setPendingShares] = useState([]);

  const handleShare = async () => {
    try {
      setError('');
      setSuccess('');
      
      if (!email.trim()) {
        setError('Please enter an email address');
        return;
      }

      const response = await axios.post(
        'http://localhost:5000/api/share/share', 
        { email: email.trim() },
        { withCredentials: true }
      );

      setSuccess(response.data.message);
      setEmail('');
      loadSharedUsers();
    } catch (error) {
      console.error('Share error:', error.response?.data || error);
      setError(
        error.response?.data?.message || 
        'Error sharing list. Please try again.'
      );
    }
  };

  const loadSharedUsers = async () => {
    try {
      const [sharedResponse, pendingResponse] = await Promise.all([
        axios.get('http://localhost:5000/api/share/shared-with', 
          { withCredentials: true }
        ),
        axios.get('http://localhost:5000/api/share/pending-shares',
          { withCredentials: true }
        )
      ]);
      setSharedUsers(sharedResponse.data);
      setPendingShares(pendingResponse.data);
    } catch (error) {
      console.error('Error loading shared users:', error);
    }
  };

  const handleUnshare = async (userId) => {
    try {
      await axios.delete(`http://localhost:5000/api/share/unshare/${userId}`,
        { withCredentials: true }
      );
      loadSharedUsers();
    } catch (error) {
      setError('Error removing share');
    }
  };

  const handleRemovePendingShare = async (email) => {
    try {
      await axios.delete(`http://localhost:5000/api/share/pending-share/${email}`,
        { withCredentials: true }
      );
      loadSharedUsers();
    } catch (error) {
      setError('Error removing pending share');
    }
  };

  React.useEffect(() => {
    if (open) {
      loadSharedUsers();
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Share Your Wishlist</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        <TextField
          fullWidth
          label="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          margin="normal"
          helperText="Enter the Google account email to share with"
        />

        <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
          Shared With
        </Typography>
        <List>
          {sharedUsers.map((share) => (
            <ListItem key={share.sharedWith._id}>
              <ListItemText
                primary={share.sharedWith.name}
                secondary={share.sharedWith.email}
              />
              <ListItemSecondaryAction>
                <IconButton 
                  edge="end" 
                  onClick={() => handleUnshare(share.sharedWith._id)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
          Pending Shares
        </Typography>
        <List>
          {pendingShares.map((pending) => (
            <ListItem key={pending.email}>
              <ListItemText
                primary={pending.email}
                secondary={`Pending since ${format(new Date(pending.createdAt), 'MMM d, yyyy')}`}
              />
              <ListItemSecondaryAction>
                <IconButton 
                  edge="end" 
                  onClick={() => handleRemovePendingShare(pending.email)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
          {pendingShares.length === 0 && (
            <ListItem>
              <ListItemText
                secondary="No pending shares"
                sx={{ textAlign: 'center', color: 'text.secondary' }}
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={handleShare} variant="contained" color="primary">
          Share
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ShareListDialog; 