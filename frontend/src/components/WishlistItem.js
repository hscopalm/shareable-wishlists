import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Box,
  Snackbar,
  Alert,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useList } from '../contexts/ListContext';
import { updateLastViewed } from '../services/api';

function WishlistItem({ item, onEdit, onDelete }) {
  const { user } = useAuth();
  const { isSharedList } = useList();
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [viewUpdated, setViewUpdated] = useState(false);

  useEffect(() => {
    const updateView = async () => {
      if (isSharedList) {
        try {
          await updateLastViewed(item.list);
        } catch (error) {
          console.error('Error updating view:', error);
        }
      }
    };

    updateView();
  }, [isSharedList, item.list]);

  const handleCardClick = () => {
    if (isSharedList) {
      // For shared lists, open link or image in new tab
      if (item.link) {
        window.open(item.link, '_blank');
      } else if (item.imageUrl) {
        window.open(item.imageUrl, '_blank');
      }
    } else {
      // For user's own lists, open edit modal
      onEdit && onEdit(item);
    }
  };

  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 1:
        return { label: 'Very Low', color: 'default' };
      case 2:
        return { label: 'Low', color: 'info' };
      case 3:
        return { label: 'Medium', color: 'warning' };
      case 4:
        return { label: 'High', color: 'error' };
      case 5:
        return { label: 'Very High', color: 'error' };
      default:
        return { label: 'None', color: 'default' };
    }
  };

  return (
    <Card 
      sx={{ 
        position: 'relative',
        '&:hover .item-actions': {
          opacity: 1
        },
        cursor: isSharedList ? 
          (item.link || item.imageUrl ? 'pointer' : 'default') : 
          'pointer',
      }}
      onClick={handleCardClick}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Typography variant="h6" component="h2">
            {item.title}
          </Typography>
          {item.link && (
            <Tooltip title="View Item">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click
                  window.open(item.link, '_blank');
                }}
                sx={{ 
                  ml: 1,
                  color: 'primary.main',
                  '&:hover': { 
                    backgroundColor: 'primary.light',
                    color: 'primary.dark'
                  }
                }}
              >
                <LinkIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {item.description && (
          <Typography color="textSecondary" gutterBottom>
            {item.description}
          </Typography>
        )}

        {item.imageUrl && (
          <CardMedia
            component="img"
            height="140"
            image={item.imageUrl}
            alt={item.title}
            sx={{ objectFit: 'contain', mt: 1, mb: 1 }}
          />
        )}

        <Box mt={2} display="flex" flexWrap="wrap" gap={1}>
          {item.price && (
            <Chip
              label={`$${item.price}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {item.priority && (
            <Chip
              label={getPriorityInfo(item.priority).label}
              size="small"
              color={getPriorityInfo(item.priority).color}
              variant="outlined"
            />
          )}
        </Box>

        {item.notes && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(255, 235, 59, 0.1)',
              border: '1px solid rgba(255, 235, 59, 0.3)',
            }}
          >
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ fontStyle: 'italic' }}
            >
              {item.notes}
            </Typography>
          </Box>
        )}

        {/* Action buttons - only show for list owners */}
        {!isSharedList && (onEdit || onDelete) && (
          <Box
            className="item-actions"
            onClick={(e) => e.stopPropagation()} // Prevent card click when clicking buttons
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              opacity: 0,
              transition: 'opacity 0.2s',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: 1,
              padding: '4px',
              display: 'flex',
              gap: 0.5,
              boxShadow: 2,
              zIndex: 1,
            }}
          >
            {onEdit && (
              <Tooltip title="Edit">
                <IconButton 
                  size="small" 
                  onClick={() => onEdit(item)}
                  sx={{ 
                    color: 'primary.main',
                    '&:hover': { 
                      backgroundColor: 'primary.light',
                      color: 'primary.dark'
                    }
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title="Delete">
                <IconButton 
                  size="small" 
                  onClick={() => onDelete(item)}
                  sx={{ 
                    color: 'error.main',
                    '&:hover': { 
                      backgroundColor: 'error.light',
                      color: 'error.dark'
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </CardContent>

      <Snackbar
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSnackbar(false)}
      >
        <Alert severity="success">{snackbarMessage}</Alert>
      </Snackbar>
    </Card>
  );
}

export default React.memo(WishlistItem); 