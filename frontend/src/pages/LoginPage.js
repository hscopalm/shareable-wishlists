import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, alpha, Link, Avatar, Stack, Divider } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';

function LoginPage() {
  const { login } = useAuth();
  const [devUsers, setDevUsers] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/auth/dev-users')
      .then((res) => {
        if (!cancelled) setDevUsers(res.data);
      })
      .catch(() => {
        if (!cancelled) setDevUsers([]);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.main,
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
      }}
    >
      {/* Background effects */}
      <Box
        sx={{
          position: 'absolute',
          top: '-30%',
          left: '-20%',
          width: '70%',
          height: '80%',
          background: `radial-gradient(ellipse, ${alpha(colors.primary, 0.12)} 0%, transparent 60%)`,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-30%',
          right: '-20%',
          width: '70%',
          height: '80%',
          background: `radial-gradient(ellipse, ${alpha(colors.secondary, 0.12)} 0%, transparent 60%)`,
          filter: 'blur(80px)',
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
          component="img"
          src="/logo.png"
          alt="Gift Guru"
          sx={{
            width: 96,
            height: 96,
            mb: 3,
          }}
        />

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
          onClick={() => login()}
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

        {/* Dev mode: pick which seed user to log in as */}
        {devUsers && devUsers.length > 0 && (
          <Box sx={{ width: '100%', mt: 3 }}>
            <Divider sx={{ mb: 2, '&::before, &::after': { borderColor: colors.border } }}>
              <Typography variant="caption" color="text.secondary">
                Dev mode — log in as
              </Typography>
            </Divider>
            <Stack spacing={1}>
              {devUsers.map((u) => (
                <Button
                  key={u._id}
                  fullWidth
                  onClick={() => login(null, u._id)}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1,
                    px: 1.5,
                    borderRadius: '12px',
                    textTransform: 'none',
                    color: colors.text.primary,
                    border: `1px solid ${colors.border}`,
                    '&:hover': {
                      background: alpha(colors.primary, 0.08),
                      borderColor: alpha(colors.primary, 0.4),
                    },
                  }}
                >
                  <Avatar src={u.picture} alt={u.name} sx={{ width: 28, height: 28, mr: 1.5 }} />
                  <Box sx={{ textAlign: 'left', overflow: 'hidden' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                      {u.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {u.email}
                    </Typography>
                  </Box>
                </Button>
              ))}
            </Stack>
          </Box>
        )}

        {/* Footer */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 4, textAlign: 'center', opacity: 0.7 }}
        >
          By continuing, you agree to our{' '}
          <Link
            component={RouterLink}
            to="/terms"
            sx={{
              color: colors.primary,
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            Terms of Service
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}

export default LoginPage;
