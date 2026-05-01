import React from 'react';
import { Box, TextField, Typography } from '@mui/material';

function MailingAddressFields({ value, onChange }) {
  const update = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        Where should gift senders ship packages? Visible to anyone with access to this list.
      </Typography>
      <TextField
        label="Recipient name"
        fullWidth
        value={value.recipientName}
        onChange={update('recipientName')}
      />
      <TextField
        label="Address line 1"
        fullWidth
        value={value.line1}
        onChange={update('line1')}
      />
      <TextField
        label="Address line 2"
        fullWidth
        value={value.line2}
        onChange={update('line2')}
      />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField label="City" sx={{ flex: '2 1 200px' }} value={value.city} onChange={update('city')} />
        <TextField label="State / Region" sx={{ flex: '1 1 120px' }} value={value.state} onChange={update('state')} />
        <TextField label="Postal code" sx={{ flex: '1 1 120px' }} value={value.postalCode} onChange={update('postalCode')} />
      </Box>
      <TextField label="Country" fullWidth value={value.country} onChange={update('country')} />
    </Box>
  );
}

export default MailingAddressFields;
