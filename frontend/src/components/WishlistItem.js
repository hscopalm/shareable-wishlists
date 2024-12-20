import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  ShoppingCart as PurchasedIcon,
  AccessTime as TentativeIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { deleteWishlistItem } from '../services/api';
import WishlistForm from './WishlistForm';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

function WishlistItem({ item, onUpdate, onStatusUpdate, isShared = false }) {
  const { user: currentUser } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === '') return null;
    return typeof price === 'number' ? price.toLocaleString() : parseFloat(price).toLocaleString();
  };

  const handleDelete = async () => {
    try {
      await deleteWishlistItem(item._id);
      onUpdate();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      1: 'rgba(76, 175, 80, 0.5)',  // Success - Low priority
      2: 'rgba(33, 150, 243, 0.5)', // Info - Medium-Low priority
      3: 'rgba(255, 152, 0, 0.5)',  // Warning - Medium priority
      4: 'rgba(244, 67, 54, 0.5)',  // Error - High priority
      5: 'rgba(244, 67, 54, 0.8)',  // Error - Very High priority
    };
    return colors[priority] || 'rgba(176, 190, 197, 0.5)';
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      1: 'Low Priority',
      2: 'Medium-Low Priority',
      3: 'Medium Priority',
      4: 'High Priority',
      5: 'Very High Priority'
    };
    return labels[priority] || 'No Priority';
  };

  const handleSetStatus = async (status) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/api/share/item-status/${item._id}`,
        { status },
        { withCredentials: true }
      );
      onStatusUpdate?.(item._id, response.data);
    } catch (error) {
      console.error('Error setting status:', error);
    }
  };

  const handleRemoveStatus = async () => {
    try {
      await axios.delete(
        `http://localhost:5000/api/share/item-status/${item._id}`,
        { withCredentials: true }
      );
      onUpdate();
    } catch (error) {
      console.error('Error removing status:', error);
    }
  };

  const getStatusStyle = (statuses) => {
    if (!statuses?.length) return {};
    
    const purchased = statuses.some(s => s.status === 'PURCHASED');
    const tentative = statuses.some(s => s.status === 'TENTATIVE');
    
    if (purchased) {
      return {
        opacity: 0.6,
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderRadius: 'inherit',
          zIndex: 1,
          pointerEvents: 'none'
        }
      };
    }
    
    if (tentative) {
      return {
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          borderRadius: 'inherit',
          zIndex: 1,
          pointerEvents: 'none'
        }
      };
    }

    return {};
  };

  const ActionButtons = () => (
    <Box 
      className="card-actions"
      sx={{ 
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 1,
        p: 1,
        background: 'linear-gradient(to top, rgba(46, 52, 64, 0.95), transparent)',
        opacity: 0,
        transform: 'translateY(10px)',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {item.link && (
        <IconButton
          size="small"
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            color: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(33, 150, 243, 0.2)',
            }
          }}
        >
          <LinkIcon fontSize="small" />
        </IconButton>
      )}
      <IconButton 
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setEditDialogOpen(true);
        }}
        sx={{ 
          color: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          '&:hover': {
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
          }
        }}
      >
        <EditIcon fontSize="small" />
      </IconButton>
      <IconButton 
        size="small"
        onClick={handleDeleteClick}
        sx={{ 
          color: '#F44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          '&:hover': {
            backgroundColor: 'rgba(244, 67, 54, 0.2)',
          }
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  const PriceTag = () => formatPrice(item.price) && (
    <Box
      sx={{
        backgroundColor: 'rgba(46, 52, 64, 0.9)',
        borderRadius: '8px',
        padding: '4px 12px',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1,
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: '#FFFFFF',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}
      >
        ${formatPrice(item.price)}
      </Typography>
    </Box>
  );

  const handleCardClick = (e) => {
    // Don't trigger card click when clicking action buttons
    if (e.target.closest('.card-actions')) {
      return;
    }

    if (isShared) {
      // For shared items, try to open link or show warning
      if (item.link) {
        window.open(item.link, '_blank');
      } else if (item.imageUrl) {
        window.open(item.imageUrl, '_blank');
      } else {
        setWarningOpen(true);
        // Auto-hide warning after 3 seconds
        setTimeout(() => {
          setWarningOpen(false);
        }, 3000);
      }
    } else {
      // For own items, open edit dialog
      setEditDialogOpen(true);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    const hasPurchased = item.statuses?.some(s => s.status === 'PURCHASED');
    const hasTentative = item.statuses?.some(s => s.status === 'TENTATIVE');
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <Card 
        onClick={handleCardClick}
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'all 0.3s ease-in-out',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor: getPriorityColor(item.priority),
          boxShadow: `0 4px 12px ${getPriorityColor(item.priority)}`,
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: `0 8px 24px ${getPriorityColor(item.priority)}`,
            '& .card-actions': {
              opacity: 1,
              transform: 'translateY(0)',
            },
            '& .card-image': {
              transform: 'scale(1.05)',
            }
          },
          ...getStatusStyle(item.statuses),
        }}
        title={isShared ? (item.link ? 'Click to open link' : 'Click to view details') : 'Click to edit'}
      >
        <PriceTag />
        {item.imageUrl && (
          <Box sx={{ position: 'relative', overflow: 'hidden', height: 160 }}>
            <CardMedia
              component="img"
              height="160"
              image={item.imageUrl}
              alt={item.title}
              className="card-image"
              sx={{ 
                objectFit: 'cover',
                borderBottom: '1px solid #3A3F4B',
                transition: 'transform 0.3s ease-in-out'
              }}
            />
          </Box>
        )}
        <CardContent sx={{ flexGrow: 1, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'flex-start' }}>
            <Typography 
              variant="h6" 
              component="div" 
              color="text.primary"
              sx={{ 
                fontSize: '1rem',
                lineHeight: 1.2,
                mb: 1,
                flex: 1
              }}
            >
              {item.title}
            </Typography>
          </Box>
          {item.description && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: 1,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: '0.875rem'
              }}
            >
              {item.description}
            </Typography>
          )}
          {item.notes && (
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                backgroundColor: 'rgba(255,215,0,0.1)',
                p: 1,
                borderRadius: 1,
                fontSize: '0.75rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {item.notes}
            </Typography>
          )}
        </CardContent>
        {!isShared && <ActionButtons />}

        {isShared && (
          <Box 
            className="card-actions"
            sx={{ 
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              p: 1,
              background: 'linear-gradient(to top, rgba(46, 52, 64, 0.95), transparent)',
              opacity: 0,
              transform: 'translateY(10px)',
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <Tooltip title="Mark as Tentative">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetStatus('TENTATIVE');
                }}
                sx={{ 
                  color: '#FF9800',
                  backgroundColor: 'rgba(255, 152, 0, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                  }
                }}
              >
                <TentativeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Mark as Purchased">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetStatus('PURCHASED');
                }}
                sx={{ 
                  color: '#4CAF50',
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                  }
                }}
              >
                <PurchasedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {item.statuses?.some(s => s.user._id === currentUser._id) && (
              <Tooltip title="Remove My Status">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveStatus();
                  }}
                  sx={{ 
                    color: '#F44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

        {item.statuses?.length > 0 && (
          <Box 
            sx={{ 
              p: 1, 
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(0, 0, 0, 0.05)'
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Status Updates:
            </Typography>
            {item.statuses.map((status) => (
              <Tooltip
                key={status._id}
                title={`${status.user.name} marked as ${status.status.toLowerCase()} on ${format(new Date(status.createdAt), 'MMM d, yyyy')}`}
                placement="top"
              >
                <Chip
                  icon={status.status === 'PURCHASED' ? <PurchasedIcon /> : <TentativeIcon />}
                  label={`${status.status.charAt(0) + status.status.slice(1).toLowerCase()} by ${status.user.name}`}
                  size="small"
                  sx={{
                    backgroundColor: status.status === 'PURCHASED' 
                      ? 'rgba(76, 175, 80, 0.1)' 
                      : 'rgba(255, 152, 0, 0.1)',
                    color: status.status === 'PURCHASED' ? '#4CAF50' : '#FF9800',
                    mr: 1,
                    mb: 1,
                    '& .MuiChip-avatar': {
                      width: 24,
                      height: 24,
                      border: `2px solid ${status.status === 'PURCHASED' ? '#4CAF50' : '#FF9800'}`,
                    }
                  }}
                  avatar={
                    <Avatar
                      src={status.user.picture}
                      alt={status.user.name}
                    />
                  }
                />
              </Tooltip>
            ))}
          </Box>
        )}
      </Card>

      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #3A3F4B' }}>
          Edit Wishlist Item
        </DialogTitle>
        <WishlistForm
          initialData={item}
          onSubmit={() => {
            setEditDialogOpen(false);
            onUpdate();
          }}
          isEditing
        />
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle sx={{ color: '#F44336' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Typography component="p" sx={{ mb: 2, fontWeight: 'bold' }}>
              Are you sure you want to delete this item? This action cannot be undone.
            </Typography>
            <Typography component="p">
              Consider editing this item instead of deleting it, especially if it has been shared with others.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            color="primary"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setEditDialogOpen(true);
            }}
            color="primary"
            variant="contained"
          >
            Edit Instead
          </Button>
          <Button
            onClick={() => {
              handleDelete();
              setDeleteDialogOpen(false);
            }}
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={warningOpen}
        autoHideDuration={3000}
        onClose={() => setWarningOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          variant="filled"
          sx={{
            backgroundColor: 'rgba(244, 67, 54, 0.9)',
            color: 'white',
            '& .MuiAlert-icon': {
              color: 'white'
            }
          }}
        >
          No link available for this item
        </Alert>
      </Snackbar>
    </>
  );
}

export default WishlistItem; 