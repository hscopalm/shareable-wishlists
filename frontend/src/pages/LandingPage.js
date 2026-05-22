import React, { useEffect, useRef, useState } from 'react';
import { Box, Container, Typography, Chip, Link, Stack, alpha } from '@mui/material';
import {
  DoneAll as DoneAllIcon,
  AutoAwesome as AutoAwesomeIcon,
  LocalShipping as ShippingIcon,
  Share as ShareIcon,
  EditNote as EditNoteIcon,
  Link as LinkIcon,
  Redeem as RedeemIcon,
  CardGiftcard as GiftIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import GoogleSignInButton from '../components/GoogleSignInButton';
import DevUserPicker from '../components/DevUserPicker';
import { colors } from '../theme';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Fades and lifts its children into view the first time they scroll into
 * the viewport. Respects prefers-reduced-motion by showing content immediately.
 */
function Reveal({ children, delay = 0, sx = {} }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

const MOCK_ITEMS = [
  { title: 'Ceramic pour-over set', price: '$48', claimed: false },
  { title: 'Merino wool scarf', price: '$35', claimed: true },
  { title: 'The Flavour Bible', price: '$32', claimed: false },
];

/** A curated, non-interactive preview of a wishlist, built from theme parts. */
function HeroMock() {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 380,
        p: 3,
        borderRadius: '24px',
        backgroundColor: colors.background.elevated,
        border: `1px solid ${colors.border}`,
        boxShadow: `0 30px 60px -20px ${alpha(colors.text.primary, 0.25)}`,
        animation: prefersReducedMotion ? 'none' : 'heroFloat 6s ease-in-out infinite',
        '@keyframes heroFloat': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      }}
    >
      {/* List header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
          }}
        >
          <GiftIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.2, color: colors.text.primary }}>
            Mom's Birthday
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Shared with 4 people
          </Typography>
        </Box>
        <Chip
          label="3 gifts"
          size="small"
          sx={{
            fontWeight: 600,
            backgroundColor: alpha(colors.primary, 0.12),
            color: colors.primary,
          }}
        />
      </Box>

      {/* Items */}
      <Stack spacing={1.25}>
        {MOCK_ITEMS.map((item) => (
          <Box
            key={item.title}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: '14px',
              border: `1px solid ${colors.border}`,
              backgroundColor: item.claimed
                ? alpha(colors.background.main, 0.7)
                : colors.background.elevated,
              opacity: item.claimed ? 0.72 : 1,
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(colors.secondary, 0.18),
              }}
            >
              <GiftIcon sx={{ fontSize: 18, color: colors.secondary }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, lineHeight: 1.3, color: colors.text.primary }}
                noWrap
              >
                {item.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.price}
              </Typography>
            </Box>
            {item.claimed ? (
              <Chip
                size="small"
                icon={<CheckIcon sx={{ fontSize: '15px !important' }} />}
                label="Claimed"
                sx={{
                  fontWeight: 600,
                  backgroundColor: alpha(colors.success, 0.16),
                  color: colors.success,
                  '& .MuiChip-icon': { color: colors.success },
                }}
              />
            ) : (
              <Box
                sx={{
                  px: 1.75,
                  py: 0.6,
                  borderRadius: '9px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  background: `linear-gradient(135deg, ${colors.success} 0%, ${alpha(colors.success, 0.82)} 100%)`,
                }}
              >
                Claim
              </Box>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

const STEPS = [
  {
    icon: EditNoteIcon,
    title: 'Build your wishlist',
    body: 'Add anything you want from any store. Include a link, a price, and a note so people know exactly what to get.',
  },
  {
    icon: LinkIcon,
    title: 'Share one link',
    body: 'Send a single link to everyone. Friends and family can open it and view your list with no account needed.',
  },
  {
    icon: RedeemIcon,
    title: 'Let them claim gifts',
    body: 'When someone claims an item, everyone else sees it is taken. You stay surprised right up to the big day.',
  },
];

const FEATURES = [
  {
    icon: DoneAllIcon,
    title: 'No duplicate gifts',
    body: 'The moment an item is claimed, everyone else sees it. No two people show up with the same present.',
  },
  {
    icon: AutoAwesomeIcon,
    title: 'Surprises stay safe',
    body: 'As the list owner you never see who claimed what. The anticipation is still all yours.',
  },
  {
    icon: ShippingIcon,
    title: 'Ship it to the door',
    body: 'Add a mailing address to any list so gift-givers can send presents straight to you.',
  },
  {
    icon: ShareIcon,
    title: 'Invite anyone in seconds',
    body: 'Share a link with the whole family. Guests can view and claim without signing up.',
  },
];

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <Box sx={{ textAlign: 'center', maxWidth: 640, mx: 'auto', mb: { xs: 5, md: 7 } }}>
      {eyebrow && (
        <Typography
          sx={{
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: colors.primary,
            mb: 1.5,
          }}
        >
          {eyebrow}
        </Typography>
      )}
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: '1.8rem', md: '2.4rem' },
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: colors.text.primary,
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body1" sx={{ color: colors.text.secondary, mt: 1.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

function LandingPage() {
  return (
    <Box sx={{ backgroundColor: colors.background.main, overflowX: 'hidden' }}>
      {/* Header */}
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box component="img" src="/logo.png" alt="Gift Guru" sx={{ width: 36, height: 36 }} />
            <Typography
              sx={{ fontWeight: 800, fontSize: '1.25rem', color: colors.text.primary }}
            >
              Gift Guru
            </Typography>
          </Box>
          <GoogleSignInButton label="Sign in" />
        </Box>
      </Container>

      {/* Hero */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            top: '-25%',
            left: '-15%',
            width: '60%',
            height: '90%',
            background: `radial-gradient(ellipse, ${alpha(colors.primary, 0.16)} 0%, transparent 60%)`,
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '-10%',
            right: '-15%',
            width: '55%',
            height: '90%',
            background: `radial-gradient(ellipse, ${alpha(colors.secondary, 0.18)} 0%, transparent 60%)`,
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, position: 'relative' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              gap: { xs: 6, md: 8 },
              py: { xs: 7, md: 12 },
            }}
          >
            {/* Hero copy */}
            <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
              <Chip
                label="Made for friends & family"
                sx={{
                  mb: 3,
                  fontWeight: 600,
                  backgroundColor: alpha(colors.primary, 0.1),
                  color: colors.primary,
                  border: `1px solid ${alpha(colors.primary, 0.2)}`,
                }}
              />
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: '-0.025em',
                  color: colors.text.primary,
                }}
              >
                Never buy a{' '}
                <Box component="span" sx={{ color: colors.primary }}>
                  duplicate gift
                </Box>{' '}
                again.
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mt: 3,
                  fontSize: '1.15rem',
                  color: colors.text.secondary,
                  maxWidth: 520,
                  mx: { xs: 'auto', md: 0 },
                }}
              >
                Gift Guru turns gift-giving into a group effort. Build a wishlist,
                share one link, and let friends and family claim what they will
                buy. No duplicates, no spoiled surprises.
              </Typography>
              <Box
                sx={{
                  mt: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: { xs: 'center', md: 'flex-start' },
                }}
              >
                <GoogleSignInButton size="large" />
                <Typography variant="caption" sx={{ mt: 1.5, color: colors.text.muted }}>
                  Free to use. No credit card, no setup.
                </Typography>
                <DevUserPicker />
              </Box>
            </Box>

            {/* Hero visual */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <HeroMock />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* How it works */}
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 8, md: 12 } }}>
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Three steps to easier gifting"
          />
        </Reveal>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: { xs: 3, md: 4 },
          }}
        >
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={index * 120}>
                <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      justifyContent: { xs: 'center', md: 'flex-start' },
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: alpha(colors.primary, 0.1),
                        border: `1px solid ${alpha(colors.primary, 0.2)}`,
                      }}
                    >
                      <Icon sx={{ color: colors.primary, fontSize: 26 }} />
                    </Box>
                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontSize: '1.5rem',
                        color: alpha(colors.primary, 0.35),
                      }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{ fontWeight: 700, fontSize: '1.2rem', color: colors.text.primary, mb: 1 }}
                  >
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                    {step.body}
                  </Typography>
                </Box>
              </Reveal>
            );
          })}
        </Box>
      </Container>

      {/* Features */}
      <Box sx={{ backgroundColor: alpha(colors.secondary, 0.07) }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 8, md: 12 } }}>
          <Reveal>
            <SectionHeading
              eyebrow="Why Gift Guru"
              title="Everything you need to coordinate gifts"
              subtitle="The small things that keep gift-giving organised and the surprise intact."
            />
          </Reveal>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 3,
            }}
          >
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={index * 100}>
                  <Box
                    sx={{
                      height: '100%',
                      p: 3,
                      borderRadius: '18px',
                      backgroundColor: colors.background.elevated,
                      border: `1px solid ${colors.border}`,
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: `0 14px 30px ${alpha(colors.text.primary, 0.1)}`,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: alpha(colors.primary, 0.1),
                        mb: 2,
                      }}
                    >
                      <Icon sx={{ color: colors.primary, fontSize: 24 }} />
                    </Box>
                    <Typography
                      sx={{ fontWeight: 700, fontSize: '1.05rem', color: colors.text.primary, mb: 1 }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                      {feature.body}
                    </Typography>
                  </Box>
                </Reveal>
              );
            })}
          </Box>
        </Container>
      </Box>

      {/* Closing CTA */}
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 9, md: 13 } }}>
        <Reveal>
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              textAlign: 'center',
              px: { xs: 3, sm: 6 },
              py: { xs: 6, md: 9 },
              borderRadius: '28px',
              border: `1px solid ${colors.border}`,
              background: `linear-gradient(135deg, ${alpha(colors.primary, 0.12)} 0%, ${alpha(colors.secondary, 0.1)} 100%)`,
            }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '1.9rem', md: '2.5rem' },
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: colors.text.primary,
              }}
            >
              Start your first wishlist
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mt: 2,
                mb: 4,
                color: colors.text.secondary,
                maxWidth: 480,
                mx: 'auto',
              }}
            >
              It takes about a minute. Sign in with Google, add a few gifts, and
              share your list today.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleSignInButton size="large" />
            </Box>
          </Box>
        </Reveal>
      </Container>

      {/* Footer */}
      <Box sx={{ borderTop: `1px solid ${colors.border}` }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              py: 4,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="img" src="/logo.png" alt="Gift Guru" sx={{ width: 28, height: 28 }} />
              <Typography sx={{ fontWeight: 700, color: colors.text.primary }}>
                Gift Guru
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: colors.text.muted }}>
              © {new Date().getFullYear()} Gift Guru
            </Typography>
            <Link
              component={RouterLink}
              to="/terms"
              sx={{
                fontSize: '0.85rem',
                color: colors.text.secondary,
                textDecoration: 'none',
                '&:hover': { color: colors.primary, textDecoration: 'underline' },
              }}
            >
              Terms of Service
            </Link>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

export default LandingPage;
