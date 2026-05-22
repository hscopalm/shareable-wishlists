import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Avatar, Stack, Divider, alpha } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';

/**
 * Dev-only seed-user login list. Renders nothing unless the backend's
 * /api/auth/dev-users endpoint returns users — production returns none —
 * so it is safe to mount directly on the public landing page.
 */
function DevUserPicker() {
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

  if (!devUsers || devUsers.length === 0) return null;

  return (
    <Box sx={{ width: '100%', maxWidth: 360, mt: 3 }}>
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
              background: colors.background.elevated,
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
  );
}

export default DevUserPicker;
