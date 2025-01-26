import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Skeleton,
  CardActionArea
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getSharedWithMe } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { useList } from '../contexts/ListContext';
import WishlistItem from '../components/WishlistItem';
import { Event as CalendarIcon } from '@mui/icons-material';

function SharedListsPage() {
  const [sharedLists, setSharedLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { setCurrentList } = useList();

  useEffect(() => {
    loadSharedLists();
  }, []);

  const loadSharedLists = async () => {
    try {
      const data = await getSharedWithMe();
      setSharedLists(data);
    } catch (error) {
      console.error('Error loading shared lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleListClick = (list) => {
    setCurrentList(list);
    navigate(`/list/${list._id}`);
  };

  const handleStatusUpdate = (itemId, newStatus) => {
    setSharedLists(prevLists => 
      prevLists.map(list => ({
        ...list,
        items: list.items?.map(item => 
          item._id === itemId 
            ? { ...item, status: newStatus }
            : item
        )
      }))
    );
  };

  if (loading) {
    return <Skeleton variant="rectangular" height={200} />;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Lists Shared With Me
      </Typography>

      <Grid container spacing={3}>
        {sharedLists.length === 0 ? (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center">
              No lists have been shared with you yet
            </Typography>
          </Grid>
        ) : (
          sharedLists.map((list) => (
            <Grid item xs={12} sm={6} md={4} key={list._id}>
              <Card 
                onClick={() => handleListClick(list)}
                sx={{
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)'
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Avatar 
                      src={list.owner.picture} 
                      alt={list.owner.name}
                      imgProps={{ 
                        referrerPolicy: "no-referrer"
                      }}
                      sx={{ mr: 2 }}
                    >
                      {list.owner.name?.[0] || '?'}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" component="div">
                        {list.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {list.owner.name}
                      </Typography>
                    </Box>
                  </Box>

                  {list.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ 
                        mt: 1,
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {list.description}
                    </Typography>
                  )}

                  {list.event_date && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ 
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <CalendarIcon fontSize="small" />
                      {new Date(list.event_date).toLocaleDateString()}
                    </Typography>
                  )}

                  <Typography variant="caption" color="text.secondary">
                    Shared {formatDistanceToNow(new Date(list.sharedAt))} ago
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>
    </Box>
  );
}

export default SharedListsPage; 