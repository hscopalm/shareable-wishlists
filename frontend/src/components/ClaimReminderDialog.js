import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

// Shown once per shared-list visit, right before the first hyperlinked gift
// opens in a new tab, so the visitor knows to come back and claim it.
function ClaimReminderDialog({ open, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={onConfirm}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px' } }}
    >
      <DialogTitle sx={{ pb: 1 }}>🎁 Quick reminder</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          If you decide to buy this, come back and claim it here so nobody else duplicates your gift.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="contained" fullWidth onClick={onConfirm}>
          Got it, continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ClaimReminderDialog;
