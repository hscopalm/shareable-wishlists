import React, { useState, useEffect } from 'react';
import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function SharedListsPage() {
  const [sharedLists, setSharedLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadSharedLists();
  }, []);

  const loadSharedLists = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/share/shared-with-me', {
        withCredentials: true
      });
      setSharedLists(response.data);
    } catch (error) {
      console.error('Error loading shared lists:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Lists Shared With Me
      </Typography>
      
      <Grid container spacing={2}>
        {sharedLists.map((sharedList) => (
          <Grid item xs={12} sm={6} md={4} key={sharedList.owner._id}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                }
              }}
              onClick={() => {
                console.log('Navigating to shared list:', sharedList.owner._id);
                navigate(`/shared/${sharedList.owner._id}`);
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar 
                    src={sharedList.owner.picture} 
                    alt={sharedList.owner.name}
                    sx={{ width: 56, height: 56 }}
                  />
                  <Box>
                    <Typography variant="h6">
                      {sharedList.owner.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {sharedList.items.length} items
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {sharedLists.length === 0 && !loading && (
        <Typography color="text.secondary" align="center">
          No wishlists have been shared with you yet
        </Typography>
      )}
    </Box>
  );
}

export default SharedListsPage; 