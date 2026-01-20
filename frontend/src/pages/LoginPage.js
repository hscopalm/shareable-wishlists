import React from 'react';
import { Box, Button, Typography, alpha } from '@mui/material';
import { Google as GoogleIcon, AutoAwesome as GiftIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

function LoginPage() {
  const { login } = useAuth();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.main,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background effects */}
      <Box
        sx={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '50%',
          height: '60%',
          background: `radial-gradient(circle, ${alpha(colors.primary, 0.15)} 0%, transparent 70%)`,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-20%',
          right: '-10%',
          width: '50%',
          height: '60%',
          background: `radial-gradient(circle, ${alpha(colors.secondary, 0.15)} 0%, transparent 70%)`,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Login Card */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: { xs: 4, sm: 6 },
          maxWidth: 420,
          width: '90%',
          backgroundColor: alpha(colors.background.elevated, 0.6),
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: `1px solid ${colors.border}`,
          boxShadow: `0 25px 50px -12px ${alpha('#000', 0.5)}`,
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: '20px',
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
            mb: 3,
            boxShadow: `0 10px 40px ${alpha(colors.primary, 0.4)}`,
          }}
        >
          <GiftIcon sx={{ color: '#fff', fontSize: 36 }} />
        </Box>

        {/* Title */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 1,
            background: `linear-gradient(135deg, ${colors.text.primary} 0%, ${colors.primary} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Gift Guru
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, textAlign: 'center' }}
        >
          Create and share wishlists with friends and family
        </Typography>

        {/* Google Sign In Button */}
        <Button
          fullWidth
          variant="contained"
          startIcon={<GoogleIcon />}
          onClick={login}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: '14px',
            background: '#fff',
            color: '#1f1f1f',
            boxShadow: `0 4px 20px ${alpha('#000', 0.15)}`,
            '&:hover': {
              background: '#f5f5f5',
              boxShadow: `0 6px 25px ${alpha('#000', 0.2)}`,
              transform: 'translateY(-2px)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          Continue with Google
        </Button>

        {/* Footer */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 4, textAlign: 'center', opacity: 0.7 }}
        >
          By continuing, you agree to our Terms of Service
        </Typography>
      </Box>
    </Box>
  );
}

export default LoginPage;
