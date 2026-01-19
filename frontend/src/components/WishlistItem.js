import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Box,
  Tooltip,
  Chip,
  Button,
  Avatar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  ShoppingCart as ClaimIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

function WishlistItem({ item, onEdit, onDelete, isSharedList, onClaim }) {
  const { user } = useAuth();
  const isClaimedByMe = item.status?.claimedBy?._id === user?._id;
  const isClaimedByOther = item.status?.claimedBy && !isClaimedByMe;
  const claimer = item.status?.claimedBy;

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
        transition: 'opacity 0.2s ease-in-out',
        ...((isSharedList && isClaimedByOther) || isClaimedByMe ? {
          opacity: 0.6,
          filter: 'grayscale(1)',
        } : {})
      }}
      onClick={handleCardClick}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography 
              variant="h6" 
              component="h2"
              sx={{
                ...(isSharedList && isClaimedByOther && {
                  color: 'text.secondary',
                })
              }}
            >
              {item.title}
            </Typography>
          </Box>
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
          <Typography 
            color="textSecondary" 
            gutterBottom
          >
            {item.description}
          </Typography>
        )}

        {item.imageUrl && (
          <CardMedia
            component="img"
            height="140"
            image={item.imageUrl}
            alt={item.title}
            sx={{ 
              objectFit: 'contain', 
              mt: 1, 
              mb: 1,
              ...((isSharedList && isClaimedByOther) || isClaimedByMe ? {
                filter: 'grayscale(1) opacity(0.6)',
              } : {})
            }}
          />
        )}

        <Box mt={2} display="flex" flexWrap="wrap" gap={1} alignItems="center">
          {item.price && (
            <Chip
              label={`$${item.price}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {item.priority && (() => {
            const { label, color } = getPriorityInfo(item.priority);
            return (
              <Chip
                label={label}
                size="small"
                color={color}
                variant="outlined"
              />
            );
          })()}
          {isSharedList && claimer && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Claimed by
              </Typography>
              <Tooltip title={claimer.name || 'Unknown User'}>
                <Avatar
                  src={claimer.picture}
                  alt={claimer.name}
                  sx={{ 
                    width: 24, 
                    height: 24,
                    border: '2px solid',
                    borderColor: isClaimedByMe ? 'success.main' : 'grey.500',
                  }}
                >
                  {claimer.name?.[0] || '?'}
                </Avatar>
              </Tooltip>
            </Box>
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

        {/* Action buttons */}
        {!isSharedList && (onEdit || onDelete) && (
          <Box
            className="item-actions"
            onClick={(e) => e.stopPropagation()}
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

        {/* Claim button for shared lists */}
        {isSharedList && onClaim && !isClaimedByOther && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              opacity: 0,
              transition: 'opacity 0.2s',
              '&:hover': {
                opacity: 1,
              },
              '.MuiCard-root:hover &': {
                opacity: 1,
              },
            }}
          >
            <Button
              variant="contained"
              size="small"
              startIcon={<ClaimIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onClaim(item);
              }}
              color={isClaimedByMe ? "error" : "primary"}
            >
              {isClaimedByMe ? "Unclaim" : "Claim"}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default React.memo(WishlistItem); 