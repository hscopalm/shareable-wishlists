import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Box,
  Dialog,
  Chip,
  DialogTitle,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { deleteWishlistItem } from '../services/api';
import WishlistForm from './WishlistForm';

function WishlistItem({ item, onUpdate }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === '') return null;
    return typeof price === 'number' ? price.toLocaleString() : parseFloat(price).toLocaleString();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteWishlistItem(item._id);
        onUpdate();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
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
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
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

  return (
    <>
      <Card 
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
          }
        }}
        title={getPriorityLabel(item.priority)}
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
        <ActionButtons />
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
    </>
  );
}

export default WishlistItem; 