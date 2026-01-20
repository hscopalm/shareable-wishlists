import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Avatar,
  Box,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Paper,
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ViewList as ListIcon,
  PeopleAlt as PeopleIcon,
  Logout as LogoutIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import { colors } from '../theme';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showLogout, setShowLogout] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const NavButton = ({ icon: Icon, label, path }) => {
    const active = isActive(path);
    return (
      <Button
        onClick={() => navigate(path)}
        sx={{
          px: { xs: 1.5, sm: 2.5 },
          py: 1,
          borderRadius: '12px',
          color: active ? colors.text.primary : colors.text.secondary,
          backgroundColor: active ? alpha(colors.primary, 0.15) : 'transparent',
          border: active ? `1px solid ${alpha(colors.primary, 0.3)}` : '1px solid transparent',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: alpha(colors.primary, 0.1),
            color: colors.text.primary,
          },
        }}
      >
        <Icon sx={{ fontSize: 20, mr: { xs: 0, sm: 1 } }} />
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontWeight: 500 }}>
          {label}
        </Box>
      </Button>
    );
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: alpha(colors.background.main, 0.8),
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', gap: 2, py: 1 }}>
        {/* Logo and Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 4 } }}>
          {/* Logo */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': {
                '& .logo-icon': {
                  transform: 'rotate(15deg) scale(1.1)',
                },
              },
            }}
            onClick={() => navigate('/')}
          >
            <Box
              className="logo-icon"
              component="img"
              src="/logo.png"
              alt="Gift Guru"
              sx={{
                width: 40,
                height: 40,
                mr: 1.5,
                transition: 'transform 0.3s ease-in-out',
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: `linear-gradient(135deg, ${colors.text.primary} 0%, ${colors.text.secondary} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
                display: { xs: 'none', md: 'block' },
              }}
            >
              Gift Guru
            </Typography>
          </Box>

          {/* Navigation */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <NavButton icon={ListIcon} label="My Lists" path="/" />
            <NavButton icon={PeopleIcon} label="Shared With Me" path="/shared" />
          </Box>
        </Box>

        {/* User Section */}
        {user && (
          <Box
            sx={{ position: 'relative' }}
            onMouseEnter={() => !isMobile && setShowLogout(true)}
            onMouseLeave={() => setShowLogout(false)}
            onClick={() => isMobile && setShowLogout(!showLogout)}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
                py: 0.75,
                px: 1.5,
                borderRadius: '14px',
                border: `1px solid ${showLogout ? alpha(colors.primary, 0.3) : 'transparent'}`,
                backgroundColor: showLogout ? alpha(colors.primary, 0.1) : 'transparent',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: alpha(colors.primary, 0.1),
                },
              }}
            >
              <Avatar
                src={user?.picture}
                alt={user?.name || 'User'}
                imgProps={{ referrerPolicy: "no-referrer" }}
                sx={{
                  width: 36,
                  height: 36,
                  border: `2px solid ${colors.primary}`,
                }}
              >
                {user?.name?.[0] || '?'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, lineHeight: 1.2 }}
                >
                  {user.name}
                </Typography>
              </Box>
              <ArrowDownIcon
                sx={{
                  fontSize: 18,
                  color: colors.text.secondary,
                  transform: showLogout ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s ease-in-out',
                  display: { xs: 'none', sm: 'block' },
                }}
              />
            </Box>

            {/* Logout Dropdown */}
            <Box
              sx={{
                position: 'absolute',
                top: '100%',
                right: 0,
                mt: 1,
                opacity: showLogout ? 1 : 0,
                visibility: showLogout ? 'visible' : 'hidden',
                transform: showLogout ? 'translateY(0)' : 'translateY(-8px)',
                transition: 'all 0.2s ease-in-out',
                zIndex: 100,
              }}
            >
              <Paper
                sx={{
                  backgroundColor: colors.background.elevated,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  minWidth: 150,
                  boxShadow: `0 10px 40px ${alpha('#000', 0.4)}`,
                }}
              >
                <MenuItem
                  onClick={logout}
                  sx={{
                    py: 1.5,
                    px: 2,
                    color: colors.error,
                    '&:hover': {
                      backgroundColor: alpha(colors.error, 0.1),
                    }
                  }}
                >
                  <ListItemIcon>
                    <LogoutIcon sx={{ color: colors.error, fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Sign out"
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: 500
                    }}
                  />
                </MenuItem>
              </Paper>
            </Box>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default React.memo(Navbar);
