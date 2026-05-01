import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { LocalShipping as ShippingIcon } from '@mui/icons-material';
import { colors } from '../theme';
import { formatMailingAddress } from '../utils/address';

function MailingAddressCard({ address }) {
  const lines = formatMailingAddress(address);
  if (!lines) return null;

  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        borderRadius: '12px',
        backgroundColor: alpha(colors.primary, 0.08),
        border: `1px solid ${alpha(colors.primary, 0.2)}`,
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
      }}
    >
      <ShippingIcon sx={{ color: colors.primary, mt: 0.25 }} />
      <Box>
        <Typography variant="caption" sx={{ color: colors.primary, fontWeight: 600, letterSpacing: 0.5 }}>
          SHIP GIFTS TO
        </Typography>
        {lines.map((line, i) => (
          <Typography key={i} variant="body2" sx={{ lineHeight: 1.5 }}>
            {line}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

export default MailingAddressCard;
