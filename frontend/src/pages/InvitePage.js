import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar,
  Alert,
  Switch,
  FormControlLabel,
  Collapse,
  Divider,
  alpha,
} from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import {
  Google as GoogleIcon,
  CalendarMonth as CalendarIcon,
  Login as JoinIcon,
  Visibility as ViewOnlyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import WishlistItem from '../components/WishlistItem';
import { getPublicList, joinListViaInvite, claimItemPublic } from '../services/api';
import { colors } from '../theme';

function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, login } = useAuth();

  const [listData, setListData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  // Welcome modal: 'choice' shows sign-in/guest options, 'guestWarning' shows the warning
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState('choice');

  const [showClaimedItems, setShowClaimedItems] = useState(() => {
    return localStorage.getItem('showClaimedItems') === 'true';
  });

  const handleToggleClaimedItems = (checked) => {
    setShowClaimedItems(checked);
    localStorage.setItem('showClaimedItems', checked.toString());
  };

  // Anonymous claim modal
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimingItemId, setClaimingItemId] = useState(null);
  const [claimerName, setClaimerName] = useState('');
  const [claimError, setClaimError] = useState('');

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPublicList(token);
      setListData(data);
      setItems(data.items);

      if (data.viewer?.isAuthenticated && data.viewer?.isSharedWith) {
        navigate(`/list/${data.list._id}`, { replace: true });
        return;
      }

      // Show welcome modal once per session for guests
      if (!data.viewer?.isAuthenticated && !sessionStorage.getItem(`invite-welcome-${token}`)) {
        setWelcomeOpen(true);
        sessionStorage.setItem(`invite-welcome-${token}`, '1');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('This invite link is no longer active.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!authLoading) {
      loadList();
    }
  }, [authLoading, loadList]);

  const list = listData?.list;
  const allowAnonymousClaims = !!list?.allowAnonymousClaims;
  const isAuthed = !!user;
  const canClaim = isAuthed || allowAnonymousClaims;
  const unclaimedItems = items.filter(i => !i.status?.claimedBy);
  const claimedItems = items.filter(i => i.status?.claimedBy);

  const handleSignIn = () => {
    login(`/invite/${token}`);
  };

  const handleJoin = async () => {
    if (!isAuthed) {
      handleSignIn();
      return;
    }
    try {
      setJoining(true);
      const result = await joinListViaInvite(token);
      navigate(`/list/${result.listId}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join list');
    } finally {
      setJoining(false);
    }
  };

  const handleClaimItem = async (item) => {
    if (isAuthed) {
      try {
        const updated = await claimItemPublic(token, item._id);
        setItems(prev => prev.map(i => (i._id === item._id ? { ...i, status: updated.status } : i)));
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to claim item');
      }
      return;
    }

    if (!allowAnonymousClaims) return;
    setClaimingItemId(item._id);
    setClaimerName('');
    setClaimError('');
    setClaimModalOpen(true);
  };

  const submitAnonymousClaim = async () => {
    if (!claimerName.trim()) {
      setClaimError('Please enter your name');
      return;
    }
    try {
      const updated = await claimItemPublic(token, claimingItemId, { claimerName: claimerName.trim() });
      setItems(prev =>
        prev.map(i => (i._id === claimingItemId ? { ...i, status: updated.status } : i))
      );
      setClaimModalOpen(false);
    } catch (err) {
      setClaimError(err.response?.data?.message || 'Failed to claim item');
    }
  };

  if (loading || authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  }

  if (error && !list) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2, color: colors.text.primary }}>
          Link Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {error}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/login')}>
          Go to Gift Guru
        </Button>
      </Box>
    );
  }

  if (!list) return null;

  return (
    <Box>
      {/* Hero Section — mirrors WishlistPage */}
      <Box
        sx={{
          position: 'relative',
          mb: 4,
          p: { xs: 3, sm: 4 },
          borderRadius: '20px',
          background: `linear-gradient(135deg, ${alpha(colors.primary, 0.1)} 0%, ${alpha(colors.secondary, 0.05)} 100%)`,
          border: `1px solid ${colors.border}`,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '40%',
            height: '100%',
            background: `radial-gradient(circle at 100% 0%, ${alpha(colors.primary, 0.15)} 0%, transparent 70%)`,
            pointerEvents: 'none',
          },
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1.75rem', sm: '2.25rem' },
            pb: 0.5,
            mb: 2,
            background: `linear-gradient(135deg, ${colors.text.primary} 0%, ${colors.primary} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {list.name}
        </Typography>

        {list.owner && (
          <Box display="flex" alignItems="center">
            <Avatar
              src={list.owner.picture}
              alt={list.owner.name}
              sx={{ width: 44, height: 44, mr: 1.5, border: `2px solid ${colors.primary}` }}
            >
              {list.owner.name?.[0] || '?'}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {list.owner.name || 'Unknown User'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                List Owner
              </Typography>
            </Box>
          </Box>
        )}

        {list.description && (
          <Typography
            variant="body1"
            sx={{
              color: colors.text.secondary,
              mt: 2.5,
              pl: 2,
              borderLeft: `3px solid ${colors.primary}`,
              fontStyle: 'italic',
            }}
          >
            {list.description}
          </Typography>
        )}

        {list.event_date && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mt: 3,
              px: 2,
              py: 1,
              borderRadius: '10px',
              backgroundColor: alpha(colors.primary, 0.1),
              border: `1px solid ${alpha(colors.primary, 0.2)}`,
            }}
          >
            <CalendarIcon sx={{ color: colors.primary, fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {new Date(list.event_date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Action / Status Bar */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        {isAuthed ? (
          <Button
            variant="contained"
            startIcon={<JoinIcon />}
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? 'Joining...' : 'Join This List'}
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              startIcon={<GoogleIcon />}
              onClick={handleSignIn}
              sx={{
                background: '#fff',
                color: '#1f1f1f',
                '&:hover': { background: '#f5f5f5' },
              }}
            >
              Sign in with Google
            </Button>
            {!allowAnonymousClaims && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: '10px',
                  backgroundColor: alpha(colors.text.muted, 0.1),
                  border: `1px solid ${alpha(colors.text.muted, 0.2)}`,
                }}
              >
                <ViewOnlyIcon sx={{ fontSize: 18, color: colors.text.secondary }} />
                <Typography variant="caption" sx={{ color: colors.text.secondary }}>
                  Read-only — sign in to claim
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Items Grid — same Masonry + claimed-collapse as WishlistPage */}
      {items.length > 0 ? (
        <>
          {unclaimedItems.length > 0 && (
            <Masonry
              columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
              spacing={2}
              defaultHeight={450}
              defaultColumns={4}
              defaultSpacing={2}
            >
              {unclaimedItems.map((item) => (
                <WishlistItem
                  key={item._id}
                  item={item}
                  isSharedList={true}
                  onClaim={canClaim ? handleClaimItem : undefined}
                />
              ))}
            </Masonry>
          )}

          {claimedItems.length > 0 && (
            <Box sx={{ my: 4, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Divider sx={{ flex: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  🎁 {claimedItems.length} claimed {claimedItems.length === 1 ? 'item' : 'items'}
                </Typography>
                <Divider sx={{ flex: 1 }} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Keep the surprise satisfying! Peek only if you need to coordinate gifts.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={showClaimedItems}
                    onChange={(e) => handleToggleClaimedItems(e.target.checked)}
                    size="small"
                  />
                }
                label={showClaimedItems ? 'Hide claimed' : 'Show claimed'}
              />
            </Box>
          )}

          <Collapse in={showClaimedItems && claimedItems.length > 0}>
            <Masonry
              columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
              spacing={2}
              defaultHeight={450}
              defaultColumns={4}
              defaultSpacing={2}
            >
              {claimedItems.map((item) => (
                <WishlistItem
                  key={item._id}
                  item={item}
                  isSharedList={true}
                  onClaim={canClaim ? handleClaimItem : undefined}
                />
              ))}
            </Masonry>
          </Collapse>

          {unclaimedItems.length === 0 && claimedItems.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                px: 4,
                borderRadius: '20px',
                backgroundColor: alpha(colors.background.elevated, 0.3),
                border: `1px dashed ${colors.border}`,
                mb: 2,
              }}
            >
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                All items have been claimed!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Toggle "Show claimed" above to see what's being gifted.
              </Typography>
            </Box>
          )}
        </>
      ) : (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body1" color="text.secondary">
            This wishlist has no items yet.
          </Typography>
        </Box>
      )}

      {/* Welcome Modal */}
      <Dialog
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        {welcomeStep === 'choice' ? (
          <>
            <DialogTitle sx={{ pb: 1 }}>You've been invited!</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Sign in to join this list, claim items, and coordinate with other gift-givers.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<GoogleIcon />}
                onClick={handleSignIn}
                sx={{ background: '#fff', color: '#1f1f1f', '&:hover': { background: '#f5f5f5' } }}
              >
                Sign in with Google
              </Button>
              <Button
                variant="text"
                fullWidth
                onClick={() => setWelcomeStep('guestWarning')}
                sx={{ color: colors.text.secondary }}
              >
                Continue as a guest
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon sx={{ color: colors.warning }} />
              Heads up
            </DialogTitle>
            <DialogContent>
              {allowAnonymousClaims ? (
                <Typography variant="body2" color="text.secondary">
                  You can claim items as a guest, but <strong>guest claims cannot be undone</strong>.
                  Make sure you really want an item before claiming.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Guest claiming is not enabled on this list, so you'll be in <strong>read-only</strong> mode.
                  Sign in if you'd like to claim an item.
                </Typography>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={() => setWelcomeStep('choice')} sx={{ color: colors.text.secondary }}>
                Back
              </Button>
              <Button variant="contained" onClick={() => setWelcomeOpen(false)}>
                Got it
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Anonymous Claim Modal */}
      <Dialog
        open={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle>Claim This Item</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Guest claims can't be undone. Make sure you are confident you are buying this item.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your name so others know who claimed it.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Your Name"
            value={claimerName}
            onChange={(e) => setClaimerName(e.target.value)}
            placeholder="e.g. John"
            error={!!claimError}
            helperText={claimError}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitAnonymousClaim();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setClaimModalOpen(false)} sx={{ color: colors.text.secondary }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitAnonymousClaim}>
            Claim
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default InvitePage;
