import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  Alert,
  Avatar,
  Chip,
  alpha,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { shareList, getSharedUsers, unshareList } from '../services/api';
import { useList } from '../contexts/ListContext';
import { colors } from '../theme';

function ShareListDialog({ open, onClose, listId }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sharedUsers, setSharedUsers] = useState([]);
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
      return;
    }

    try {
      const data = await getSharedUsers(listId);
      setSharedUsers(data);
    } catch (error) {
      console.error('Error loading shared users:', error);
      setError('Failed to load shared users');
    }
  }, [listId]);

  useEffect(() => {
    if (open) {
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: '20px' },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>Share Your List</DialogTitle>
      <DialogContent>
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
              borderRadius: '12px',
              backgroundColor: alpha(colors.error, 0.1),
              color: colors.error,
              '& .MuiAlert-icon': { color: colors.error },
            }}
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            sx={{
              mb: 2,
              borderRadius: '12px',
              backgroundColor: alpha(colors.success, 0.1),
              color: colors.success,
              '& .MuiAlert-icon': { color: colors.success },
            }}
          >
            {success}
          </Alert>
        )}

        <form onSubmit={handleShare}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              size="medium"
            />
            <Button
              type="submit"
              variant="contained"
              sx={{ py: 1.75, px: 3, minWidth: 'auto' }}
            >
              <PersonAddIcon />
            </Button>
          </Box>
        </form>

        <Typography
          variant="subtitle2"
          sx={{ mt: 4, mb: 2, color: colors.text.secondary }}
        >
          People with access
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sharedUsers.map((share) => (
            <Box
              key={share.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                borderRadius: '14px',
                backgroundColor: alpha(colors.background.card, 0.5),
                border: `1px solid ${colors.border}`,
              }}
            >
              {share.isPending ? (
                <Avatar sx={{ bgcolor: colors.text.muted, width: 40, height: 40 }}>
                  {share.email[0].toUpperCase()}
                </Avatar>
              ) : share.picture ? (
                <Avatar
                  src={share.picture}
                  sx={{ width: 40, height: 40, border: `2px solid ${colors.primary}` }}
                />
              ) : (
                <Avatar sx={{ width: 40, height: 40, border: `2px solid ${colors.primary}` }}>
                  {(share.name || share.email)[0].toUpperCase()}
                </Avatar>
              )}

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {share.name || share.email}
                  </Typography>
                  {share.isPending && (
                    <Chip
                      size="small"
                      label="Pending"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        backgroundColor: alpha(colors.warning, 0.15),
                        color: colors.warning,
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <ScheduleIcon sx={{ fontSize: 14, color: colors.text.muted }} />
                  <Typography variant="caption" color="text.secondary">
                    {share.lastViewed
                      ? `Viewed ${format(new Date(share.lastViewed), 'MMM d, yyyy')}`
                      : 'Never viewed'
                    }
                  </Typography>
                </Box>
              </Box>

              <IconButton
                size="small"
                onClick={() => handleUnshare(share.id)}
                sx={{
                  color: colors.error,
                  '&:hover': {
                    backgroundColor: alpha(colors.error, 0.1),
                  },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}

          {(!sharedUsers || sharedUsers.length === 0) && (
            <Box
              sx={{
                py: 4,
                textAlign: 'center',
                color: colors.text.secondary,
              }}
            >
              <Typography variant="body2">
                No one has access to this list yet
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ color: colors.text.secondary }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ShareListDialog;
