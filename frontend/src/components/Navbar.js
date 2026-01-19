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
  Popper,
  Paper,
  Grow,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useList } from '../contexts/ListContext';
import { 
  List as ListIcon,
  CardGiftcard as GiftIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';

function Navbar() {
  const { user, logout } = useAuth();
  const { lists } = useList();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [listsAnchorEl, setListsAnchorEl] = useState(null);
  const [showLogout, setShowLogout] = useState(false);

  const handleListsMouseEnter = (event) => {
    if (!isMobile) {
      setListsAnchorEl(event.currentTarget);
    }
  };

  const handleListsMouseLeave = () => {
    setListsAnchorEl(null);
  };

  const handleListClick = (list) => {
    setListsAnchorEl(null);
    navigate(`/list/${list._id}`);
  };

  const recentLists = lists.slice(0, 5);
  const open = Boolean(listsAnchorEl);

  return (
    <AppBar 
      position="static" 
      sx={{ 
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', gap: { xs: 1, sm: 4 } }}>
        {/* Logo and Navigation Links - now grouped together */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 } }}>
          {/* Logo and Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <GiftIcon sx={{ color: 'primary.main', mr: 1, fontSize: 28 }} />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 600,
                color: 'text.primary',
                letterSpacing: '0.5px',
              }}
            >
              Gift Guru
            </Typography>
          </Box>
          
          {/* Navigation Links - moved here and updated typography */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
            <Button
              color="inherit"
              startIcon={<ListIcon />}
              onMouseEnter={handleListsMouseEnter}
              onClick={() => navigate('/')}
              sx={{
                borderRadius: '8px',
                px: { xs: 1, sm: 2 },
                fontSize: '1rem',
                fontWeight: 500,
                minWidth: { xs: 'auto', sm: 'auto' },
                '&:hover': {
                  backgroundColor: 'rgba(76, 175, 80, 0.08)',
                }
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                My Lists
              </Box>
            </Button>

            <Button
              color="inherit"
              startIcon={<PeopleIcon />}
              onClick={() => navigate('/shared')}
              sx={{
                borderRadius: '8px',
                px: { xs: 1, sm: 2 },
                fontSize: '1rem',
                fontWeight: 500,
                minWidth: { xs: 'auto', sm: 'auto' },
                '&:hover': {
                  backgroundColor: 'rgba(76, 175, 80, 0.08)',
                }
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Shared With Me
              </Box>
            </Button>
          </Box>
        </Box>

        {/* User Section - updated typography */}
        {user && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              position: 'relative',
            }}
            onMouseEnter={() => !isMobile && setShowLogout(true)}
            onMouseLeave={() => setShowLogout(false)}
            onClick={() => isMobile && setShowLogout(!showLogout)}
          >
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease-in-out',
                backgroundColor: showLogout ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
              }}
            >
              <Avatar
                src={user?.picture}
                alt={user?.name || 'User'}
                imgProps={{ 
                  referrerPolicy: "no-referrer"
                }}
                sx={{ 
                  width: 36, 
                  height: 36,
                  border: '2px solid',
                  borderColor: 'primary.main',
                }}
              >
                {user?.name?.[0] || '?'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    fontWeight: 500,
                    fontSize: '1rem',
                  }}
                >
                  {user.name}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                position: 'absolute',
                top: '100%',
                right: 0,
                mt: 0.5,
                opacity: showLogout ? 1 : 0,
                visibility: showLogout ? 'visible' : 'hidden',
                transform: showLogout ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <Paper
                elevation={4}
                sx={{
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <MenuItem 
                  onClick={logout}
                  sx={{ 
                    py: 1,
                    px: 2,
                    color: 'error.main',
                    '&:hover': {
                      backgroundColor: 'rgba(244, 67, 54, 0.08)',
                    }
                  }}
                >
                  <ListItemIcon>
                    <LogoutIcon sx={{ color: 'error.main' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Logout"
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

        {/* Lists Dropdown */}
        <Popper
          open={open}
          anchorEl={listsAnchorEl}
          placement="bottom-start"
          transition
          onMouseLeave={handleListsMouseLeave}
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps}>
              <Paper
                sx={{
                  mt: 1,
                  minWidth: { xs: 200, sm: 250 },
                  maxWidth: '90vw',
                  backgroundColor: 'background.paper',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                }}
              >
                {recentLists.map((list) => (
                  <MenuItem 
                    key={list._id}
                    onClick={() => handleListClick(list)}
                    sx={{ 
                      py: 1.5,
                      '&:hover': {
                        backgroundColor: 'rgba(76, 175, 80, 0.08)',
                      }
                    }}
                  >
                    <ListItemIcon>
                      <ListIcon sx={{ color: 'primary.main' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={list.name}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: 500
                      }}
                    />
                  </MenuItem>
                ))}
                <Divider sx={{ my: 1 }} />
                <MenuItem 
                  onClick={() => navigate('/')}
                  sx={{ 
                    py: 1.5,
                    color: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'rgba(76, 175, 80, 0.08)',
                    }
                  }}
                >
                  <ListItemText 
                    primary="View All Lists"
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: 500
                    }}
                  />
                </MenuItem>
              </Paper>
            </Grow>
          )}
        </Popper>
      </Toolbar>
    </AppBar>
  );
}

export default React.memo(Navbar); 