import React from 'react';
import { AppBar, Toolbar, Typography, Button, Avatar, Box, Tabs, Tab } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleTabChange = (event, newValue) => {
    navigate(newValue);
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
          Wishlist App
        </Typography>
        <Tabs 
          value={location.pathname} 
          onChange={handleTabChange}
          sx={{ flexGrow: 1 }}
          textColor="inherit"
          indicatorColor="secondary"
        >
          <Tab label="My List" value="/" />
          <Tab label="Shared With Me" value="/shared" />
        </Tabs>
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={user.picture}
              alt={user.name}
              sx={{ width: 32, height: 32 }}
            />
            <Typography variant="body2" sx={{ mr: 2 }}>
              {user.name}
            </Typography>
            <Button color="inherit" onClick={logout}>
              Logout
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Navbar; 