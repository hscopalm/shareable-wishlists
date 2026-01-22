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
  alpha,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  OpenInNew as LinkIcon,
  ShoppingBag as ClaimIcon,
  RemoveShoppingCart as UnclaimIcon,
  StickyNote2 as NoteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

function WishlistItem({ item, onEdit, onDelete, isSharedList, onClaim }) {
  const { user } = useAuth();
  const isClaimedByMe = item.status?.claimedBy?._id === user?._id;
  const isClaimedByOther = item.status?.claimedBy && !isClaimedByMe;
  const claimer = item.status?.claimedBy;
  const isClaimed = isClaimedByMe || isClaimedByOther;
  // Only show claimed styling on shared lists - owners should never see items as claimed
  const showClaimedStyle = isClaimed && isSharedList;

  const handleCardClick = () => {
    if (isSharedList) {
      if (item.link) {
        window.open(item.link, '_blank');
      } else if (item.imageUrl) {
        window.open(item.imageUrl, '_blank');
      }
    } else {
      onEdit && onEdit(item);
    }
  };

  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 1:
        return { label: 'Low', color: colors.text.muted, bg: alpha(colors.text.muted, 0.15) };
      case 2:
        return { label: 'Normal', color: colors.accent, bg: alpha(colors.accent, 0.15) };
      case 3:
        return { label: 'Medium', color: colors.warning, bg: alpha(colors.warning, 0.15) };
      case 4:
        return { label: 'High', color: colors.secondary, bg: alpha(colors.secondary, 0.15) };
      case 5:
        return { label: 'Must Have', color: colors.error, bg: alpha(colors.error, 0.15) };
      default:
        return null;
    }
  };

  const priorityInfo = getPriorityInfo(item.priority);

  return (
    <Card
      sx={{
        position: 'relative',
        cursor: isSharedList
          ? (item.link || item.imageUrl ? 'pointer' : 'default')
          : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'visible',
        '&:hover': {
          transform: showClaimedStyle ? 'none' : 'translateY(-4px)',
          '& .item-actions': {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
        ...(showClaimedStyle && {
          opacity: 0.65,
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundColor: alpha(colors.background.main, 0.3),
            borderRadius: 'inherit',
            pointerEvents: 'none',
          },
        }),
      }}
      onClick={handleCardClick}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              fontSize: '1.1rem',
              lineHeight: 1.3,
              pr: 1,
              color: showClaimedStyle ? colors.text.secondary : colors.text.primary,
            }}
          >
            {item.title}
          </Typography>
          {item.link && (
            <Tooltip title="Open link">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(item.link, '_blank');
                }}
                sx={{
                  color: colors.primary,
                  backgroundColor: alpha(colors.primary, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(colors.primary, 0.2),
                  },
                }}
              >
                <LinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Description */}
        {item.description && (
          <Typography
            variant="body2"
            sx={{
              color: colors.text.secondary,
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description}
          </Typography>
        )}

        {/* Image */}
        {item.imageUrl && (
          <Box
            sx={{
              position: 'relative',
              borderRadius: 2,
              overflow: 'hidden',
              mb: 2,
              backgroundColor: alpha(colors.background.main, 0.5),
            }}
          >
            <CardMedia
              component="img"
              height="160"
              image={item.imageUrl}
              alt={item.title}
              sx={{
                objectFit: 'contain',
                filter: showClaimedStyle ? 'grayscale(0.8)' : 'none',
                transition: 'filter 0.3s ease',
              }}
            />
          </Box>
        )}

        {/* Tags */}
        <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
          {item.price && (
            <Chip
              label={`$${item.price}`}
              size="small"
              sx={{
                fontWeight: 600,
                backgroundColor: alpha(colors.success, 0.15),
                color: colors.success,
                border: `1px solid ${alpha(colors.success, 0.3)}`,
              }}
            />
          )}
          {priorityInfo && (
            <Chip
              label={priorityInfo.label}
              size="small"
              sx={{
                fontWeight: 500,
                backgroundColor: priorityInfo.bg,
                color: priorityInfo.color,
                border: `1px solid ${alpha(priorityInfo.color, 0.3)}`,
              }}
            />
          )}
          {isSharedList && claimer && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 'auto' }}>
              <Typography variant="caption" color="text.secondary">
                {isClaimedByMe ? 'You claimed this' : 'Claimed by'}
              </Typography>
              <Tooltip title={claimer.name || 'Unknown'}>
                <Avatar
                  src={claimer.picture}
                  alt={claimer.name}
                  sx={{
                    width: 24,
                    height: 24,
                    border: `2px solid ${isClaimedByMe ? colors.success : colors.text.muted}`,
                    boxShadow: isClaimedByMe ? `0 0 10px ${alpha(colors.success, 0.5)}` : 'none',
                  }}
                >
                  {claimer.name?.[0] || '?'}
                </Avatar>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* Notes */}
        {item.notes && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              backgroundColor: alpha(colors.warning, 0.08),
              border: `1px solid ${alpha(colors.warning, 0.2)}`,
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
            }}
          >
            <NoteIcon sx={{ color: colors.warning, fontSize: 18, mt: 0.25 }} />
            <Typography
              variant="body2"
              sx={{
                color: colors.text.secondary,
                fontStyle: 'italic',
                fontSize: '0.85rem',
              }}
            >
              {item.notes}
            </Typography>
          </Box>
        )}

        {/* Action buttons for owner */}
        {!isSharedList && (onEdit || onDelete) && (
          <Box
            className="item-actions"
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              opacity: { xs: 1, sm: 0 },
              transform: { xs: 'translateY(0)', sm: 'translateY(8px)' },
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              gap: 0.5,
              backgroundColor: colors.background.elevated,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '6px',
              boxShadow: `0 4px 20px ${alpha('#000', 0.3)}`,
            }}
          >
            {onEdit && (
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => onEdit(item)}
                  sx={{
                    color: colors.primary,
                    '&:hover': {
                      backgroundColor: alpha(colors.primary, 0.15),
                    },
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
                    color: colors.error,
                    '&:hover': {
                      backgroundColor: alpha(colors.error, 0.15),
                    },
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
          <>
            {/* Mobile: inline button */}
            <Box
              sx={{
                display: { xs: 'flex', sm: 'none' },
                justifyContent: 'flex-end',
                mt: 2,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="contained"
                size="small"
                startIcon={isClaimedByMe ? <UnclaimIcon /> : <ClaimIcon />}
                onClick={() => onClaim(item)}
                sx={{
                  borderRadius: '10px',
                  px: 2,
                  py: 0.75,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  ...(isClaimedByMe
                    ? {
                        background: `linear-gradient(135deg, ${colors.error} 0%, ${alpha(colors.error, 0.8)} 100%)`,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${colors.error} 20%, ${alpha(colors.error, 0.9)} 100%)`,
                        },
                      }
                    : {
                        background: `linear-gradient(135deg, ${colors.success} 0%, ${alpha(colors.success, 0.8)} 100%)`,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${colors.success} 20%, ${alpha(colors.success, 0.9)} 100%)`,
                        },
                      }),
                }}
              >
                {isClaimedByMe ? 'Unclaim' : 'Claim'}
              </Button>
            </Box>
            {/* Desktop: hover button */}
            <Box
              className="item-actions"
              sx={{
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                bottom: 12,
                right: 12,
                opacity: 0,
                transform: 'translateY(8px)',
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <Button
                variant="contained"
                size="small"
                startIcon={isClaimedByMe ? <UnclaimIcon /> : <ClaimIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  onClaim(item);
                }}
                sx={{
                  borderRadius: '10px',
                  px: 2,
                  py: 0.75,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  ...(isClaimedByMe
                    ? {
                        background: `linear-gradient(135deg, ${colors.error} 0%, ${alpha(colors.error, 0.8)} 100%)`,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${colors.error} 20%, ${alpha(colors.error, 0.9)} 100%)`,
                        },
                      }
                    : {
                        background: `linear-gradient(135deg, ${colors.success} 0%, ${alpha(colors.success, 0.8)} 100%)`,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${colors.success} 20%, ${alpha(colors.success, 0.9)} 100%)`,
                        },
                      }),
                }}
              >
                {isClaimedByMe ? 'Unclaim' : 'Claim'}
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default React.memo(WishlistItem);
