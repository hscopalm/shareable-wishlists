import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Skeleton,
  alpha,
  Switch,
  FormControlLabel,
  Collapse,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getSharedWithMe } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { useList } from '../contexts/ListContext';
import {
  CalendarMonth as CalendarIcon,
  PeopleAlt as EmptyIcon,
  ArrowForward as ArrowIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { colors } from '../theme';

function SharedListsPage() {
  const [sharedLists, setSharedLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  const { setCurrentList } = useList();

  // Filter lists into active and archived
  const activeLists = sharedLists.filter(list => !list.isArchived);
  const archivedLists = sharedLists.filter(list => list.isArchived);

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

  if (loading) {
    return (
      <Box>
        <Skeleton
          variant="text"
          width={200}
          height={40}
          sx={{ mb: 4 }}
        />
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton
                variant="rounded"
                height={180}
                sx={{ borderRadius: '16px' }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.text.primary} 0%, ${colors.primary} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Shared With Me
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {activeLists.length} {activeLists.length === 1 ? 'list' : 'lists'} shared with you
            {archivedLists.length > 0 && ` (${archivedLists.length} archived)`}
          </Typography>
        </Box>
        {archivedLists.length > 0 && (
          <FormControlLabel
            control={
              <Switch
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                color="primary"
              />
            }
            label="Show archived"
          />
        )}
      </Box>

      {/* Lists Grid */}
      {activeLists.length > 0 ? (
        <Grid container spacing={3}>
          {activeLists.map((list) => (
            <Grid item xs={12} sm={6} md={4} key={list._id}>
              <Card
                onClick={() => handleListClick(list)}
                sx={{
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    '& .card-arrow': {
                      opacity: 1,
                      transform: 'translateX(0)',
                    },
                  },
                }}
              >
                <CardContent sx={{ flex: 1, p: 3 }}>
                  {/* Owner */}
                  <Box display="flex" alignItems="center" mb={2}>
                    <Avatar
                      src={list.owner.picture}
                      alt={list.owner.name}
                      imgProps={{ referrerPolicy: "no-referrer" }}
                      sx={{
                        width: 40,
                        height: 40,
                        mr: 1.5,
                        border: `2px solid ${colors.primary}`,
                      }}
                    >
                      {list.owner.name?.[0] || '?'}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {list.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        by {list.owner.name}
                      </Typography>
                    </Box>
                    <ArrowIcon
                      className="card-arrow"
                      sx={{
                        color: colors.primary,
                        opacity: 0,
                        transform: 'translateX(-8px)',
                        transition: 'all 0.2s ease-in-out',
                        ml: 1,
                      }}
                    />
                  </Box>

                  {/* Description */}
                  {list.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {list.description}
                    </Typography>
                  )}

                  {/* Event Date */}
                  {list.event_date && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px',
                        backgroundColor: alpha(colors.primary, 0.1),
                        border: `1px solid ${alpha(colors.primary, 0.2)}`,
                      }}
                    >
                      <CalendarIcon sx={{ fontSize: 16, color: colors.primary }} />
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        {new Date(list.event_date.split('T')[0] + 'T12:00:00').toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}

                  {/* Shared Time */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: list.event_date ? 1.5 : 0 }}
                  >
                    Shared {formatDistanceToNow(new Date(list.sharedAt))} ago
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : sharedLists.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 10,
            px: 4,
            borderRadius: '20px',
            backgroundColor: alpha(colors.background.elevated, 0.3),
            border: `1px dashed ${colors.border}`,
          }}
        >
          <EmptyIcon
            sx={{
              fontSize: 72,
              color: colors.text.muted,
              mb: 3,
              opacity: 0.5,
            }}
          />
          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            No shared lists yet
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ textAlign: 'center', maxWidth: 400 }}
          >
            When someone shares their wishlist with you, it will appear here
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 10,
            px: 4,
            borderRadius: '20px',
            backgroundColor: alpha(colors.background.elevated, 0.3),
            border: `1px dashed ${colors.border}`,
          }}
        >
          <ArchiveIcon
            sx={{
              fontSize: 72,
              color: colors.text.muted,
              mb: 3,
              opacity: 0.5,
            }}
          />
          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            All shared lists archived
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ textAlign: 'center', maxWidth: 400 }}
          >
            Toggle "Show archived" above to view archived shared lists
          </Typography>
        </Box>
      )}

      {/* Archived Lists Section */}
      <Collapse in={showArchived && archivedLists.length > 0}>
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <ArchiveIcon sx={{ color: colors.text.secondary }} />
            <Typography variant="h6" color="text.secondary">
              Archived Lists ({archivedLists.length})
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {archivedLists.map((list) => (
              <Grid item xs={12} sm={6} md={4} key={list._id}>
                <Card
                  onClick={() => handleListClick(list)}
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    opacity: 0.7,
                    '&:hover': {
                      opacity: 1,
                      transform: 'translateY(-6px)',
                      '& .card-arrow': {
                        opacity: 1,
                        transform: 'translateX(0)',
                      },
                    },
                  }}
                >
                  <CardContent sx={{ flex: 1, p: 3 }}>
                    {/* Owner */}
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar
                        src={list.owner.picture}
                        alt={list.owner.name}
                        imgProps={{ referrerPolicy: "no-referrer" }}
                        sx={{
                          width: 40,
                          height: 40,
                          mr: 1.5,
                          border: `2px solid ${colors.primary}`,
                        }}
                      >
                        {list.owner.name?.[0] || '?'}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {list.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          by {list.owner.name}
                        </Typography>
                      </Box>
                      <ArrowIcon
                        className="card-arrow"
                        sx={{
                          color: colors.primary,
                          opacity: 0,
                          transform: 'translateX(-8px)',
                          transition: 'all 0.2s ease-in-out',
                          ml: 1,
                        }}
                      />
                    </Box>

                    {/* Description */}
                    {list.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {list.description}
                      </Typography>
                    )}

                    {/* Event Date */}
                    {list.event_date && (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.75,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '8px',
                          backgroundColor: alpha(colors.primary, 0.1),
                          border: `1px solid ${alpha(colors.primary, 0.2)}`,
                        }}
                      >
                        <CalendarIcon sx={{ fontSize: 16, color: colors.primary }} />
                        <Typography variant="caption" sx={{ fontWeight: 500 }}>
                          {new Date(list.event_date.split('T')[0] + 'T12:00:00').toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}

                    {/* Shared Time */}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: list.event_date ? 1.5 : 0 }}
                    >
                      Shared {formatDistanceToNow(new Date(list.sharedAt))} ago
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Collapse>
    </Box>
  );
}

export default SharedListsPage;
