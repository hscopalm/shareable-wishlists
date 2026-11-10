import React from 'react';
import { Box, Typography, Container, alpha, IconButton } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme';

function PrivacyPolicyPage() {
  const navigate = useNavigate();

  const Section = ({ title, children }) => (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          color: colors.text.primary,
          mb: 2,
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: colors.text.secondary,
          lineHeight: 1.8,
        }}
      >
        {children}
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background.main,
        overflow: 'auto',
        py: 4,
        zIndex: 1200,
      }}
    >
      <Container maxWidth="md">
        <Box
          sx={{
            backgroundColor: alpha(colors.background.elevated, 0.6),
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: `1px solid ${colors.border}`,
            p: { xs: 3, sm: 5 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <IconButton
              onClick={() => navigate(-1)}
              sx={{
                mr: 2,
                color: colors.text.secondary,
                '&:hover': {
                  color: colors.text.primary,
                  backgroundColor: alpha(colors.primary, 0.1),
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
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
              Privacy Policy
            </Typography>
          </Box>

          <Typography
            variant="body2"
            sx={{
              color: colors.text.secondary,
              mb: 4,
              fontStyle: 'italic',
            }}
          >
            Last updated: 2026-11-09
          </Typography>

          <Section title="What we collect">
            From Google sign-in we store your name, email address, and profile picture. We store the
            lists and items you create, the email addresses of people you share lists with, and the
            items you claim on other people's lists. We also keep activity logs (such as list views,
            shares, and claims) and session data so you stay signed in.
          </Section>

          <Section title="Who sees what">
            List owners never see who claimed their items. People you share a list with can see the
            list, its items, and each other's claims. Your email address may be visible to people you
            share lists with or who share lists with you.
          </Section>

          <Section title="AI assistants">
            If you connect an AI assistant, we store a hashed copy of each access token (we cannot
            read it back), the name of the connected app, and when it was last used. Anything an
            assistant reads on your behalf is sent to that assistant's provider under their privacy
            policy. You can revoke any connection at any time on the Connect page.
          </Section>

          <Section title="How we use it">
            We use your data only to run Gift Guru: showing your lists, sharing them, preventing
            duplicate gifts, and sending share invitations by email. We do not sell your data, and we
            do not use it for advertising.
          </Section>

          <Section title="Storage and retention">
            Data is stored in MongoDB Atlas and served from AWS. Sessions expire after 24 hours. Your
            lists and claims stay until you delete them or ask us to delete your account.
          </Section>

          <Section title="Your choices">
            You can edit or delete your lists and items, unshare lists, and revoke AI assistant
            access in the app. To delete your account and data, contact us at the address below.
          </Section>

          <Section title="Changes">
            If this policy changes, we will update the date at the top of this page.
          </Section>

          <Section title="Contact">
            Questions or deletion requests: hello.guru.gifter@gmail.com
          </Section>
        </Box>
      </Container>
    </Box>
  );
}

export default PrivacyPolicyPage;
