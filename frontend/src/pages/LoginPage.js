import React from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

function LoginPage() {
  const { login } = useAuth();

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1E1E2E',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          backgroundColor: '#2E3440',
          borderRadius: 2,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Typography variant="h5" color="white">
          Welcome to Gift Guru
        </Typography>
        <Button
          variant="contained"
          startIcon={<GoogleIcon />}
          onClick={login}
          sx={{
            backgroundColor: '#4285F4',
            color: 'white',
            '&:hover': {
              backgroundColor: '#357ABD',
            },
            px: 3,
            py: 1,
          }}
        >
          Sign in with Google
        </Button>
      </Paper>
    </Box>
  );
}

export default LoginPage; 