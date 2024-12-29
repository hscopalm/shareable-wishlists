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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useList } from '../contexts/ListContext';
import { List as ListIcon } from '@mui/icons-material';

function Navbar() {
  const { user, logout } = useAuth();
  const { lists } = useList();
  const navigate = useNavigate();
  const [listsAnchorEl, setListsAnchorEl] = useState(null);

  const handleListsMouseEnter = (event) => {
    setListsAnchorEl(event.currentTarget);
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
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
          Gift Guru
        </Typography>
        
        <Box sx={{ position: 'relative' }}>
          <Button
            color="inherit"
            onMouseEnter={handleListsMouseEnter}
            onClick={() => navigate('/lists')}
            sx={{ mr: 2 }}
          >
            My Lists
          </Button>
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
                    minWidth: 200,
                    backgroundColor: 'background.paper' 
                  }}
                >
                  {recentLists.map((list) => (
                    <MenuItem 
                      key={list._id}
                      onClick={() => handleListClick(list)}
                    >
                      <ListItemIcon>
                        <ListIcon />
                      </ListItemIcon>
                      <ListItemText primary={list.name} />
                    </MenuItem>
                  ))}
                  <MenuItem onClick={() => navigate('/lists')}>
                    <ListItemText primary="View All Lists" />
                  </MenuItem>
                </Paper>
              </Grow>
            )}
          </Popper>
        </Box>

        <Button 
          color="inherit" 
          onClick={() => navigate('/shared')}
          sx={{ mr: 2 }}
        >
          Shared With Me
        </Button>

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
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

export default React.memo(Navbar); 