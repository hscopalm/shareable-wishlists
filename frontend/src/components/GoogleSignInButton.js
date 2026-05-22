import React from 'react';
import { Button, alpha } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

/**
 * Google OAuth sign-in button, shared across the landing page header, hero
 * and closing CTA. `size="large"` is the prominent hero/CTA treatment;
 * the default is a compact button for the header.
 */
function GoogleSignInButton({
  label = 'Continue with Google',
  size = 'medium',
  fullWidth = false,
  sx = {},
}) {
  const { login } = useAuth();
  const large = size === 'large';

  return (
    <Button
      variant="contained"
      fullWidth={fullWidth}
      startIcon={<GoogleIcon />}
      onClick={() => login()}
      sx={{
        py: large ? 1.5 : 1,
        px: large ? 4 : 2.5,
        fontSize: large ? '1rem' : '0.9rem',
        fontWeight: 600,
        borderRadius: '14px',
        background: '#fff',
        color: '#1f1f1f',
        boxShadow: `0 4px 20px ${alpha('#000', 0.12)}`,
        '&:hover': {
          background: '#f5f5f5',
          boxShadow: `0 6px 25px ${alpha('#000', 0.18)}`,
          transform: 'translateY(-2px)',
        },
        transition: 'all 0.2s ease-in-out',
        ...sx,
      }}
    >
      {label}
    </Button>
  );
}

export default GoogleSignInButton;
