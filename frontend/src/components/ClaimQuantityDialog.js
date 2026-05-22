import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Button,
  Box,
  Alert,
} from '@mui/material';
import { colors } from '../theme';
import { getRequestedQty, getRemainingForMe, getMyClaim } from '../utils/itemClaims';

// Dialog used by shared-list users to pick how many of a multi-quantity item
// they're claiming. Doubles as the edit-claim dialog: if the user already has
// a claim, the input is pre-filled and an Unclaim button appears.
function ClaimQuantityDialog({ open, onClose, item, userId, onSubmit, anonymous, claimerName, onClaimerNameChange, claimerNameError }) {
  const requested = getRequestedQty(item);
  const remainingForMe = item ? getRemainingForMe(item, userId) : 0;
  const myClaim = item ? getMyClaim(item, userId) : null;
  const isEditing = !!myClaim;
  const initialQty = isEditing ? myClaim.quantity || 1 : Math.min(1, remainingForMe);

  const [qty, setQty] = useState(initialQty);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setQty(initialQty);
      setError('');
    }
  }, [open, initialQty]);

  if (!item) return null;

  const handleSubmit = (unclaim = false) => {
    const value = unclaim ? 0 : Number(qty);
    if (!unclaim) {
      if (!Number.isInteger(value) || value < 1) {
        setError('Enter a whole number, 1 or more');
        return;
      }
      if (value > remainingForMe) {
        setError(`Only ${remainingForMe} remaining`);
        return;
      }
    }
    onSubmit(value);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px' } }}
    >
      <DialogTitle>Claim {item.title}</DialogTitle>
      <DialogContent>
        {anonymous && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Guest claims can't be undone. Make sure you are confident you are buying this item.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {requested} requested · {remainingForMe} still available for you to claim.
        </Typography>
        {anonymous && (
          <TextField
            autoFocus
            fullWidth
            label="Your Name"
            value={claimerName || ''}
            onChange={(e) => onClaimerNameChange && onClaimerNameChange(e.target.value)}
            placeholder="e.g. John"
            error={!!claimerNameError}
            helperText={claimerNameError}
            sx={{ mb: 2 }}
          />
        )}
        <TextField
          autoFocus={!anonymous}
          fullWidth
          label="How many?"
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputProps={{ min: 1, max: remainingForMe, step: 1 }}
          error={!!error}
          helperText={error || ' '}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Box>
            {isEditing && !anonymous && (
              <Button onClick={() => handleSubmit(true)} sx={{ color: colors.error }}>
                Unclaim
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} sx={{ color: colors.text.secondary }}>Cancel</Button>
            <Button variant="contained" onClick={() => handleSubmit(false)}>
              {isEditing ? 'Update' : 'Claim'}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default ClaimQuantityDialog;
