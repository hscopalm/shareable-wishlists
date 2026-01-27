import React from 'react';
import { Box, Typography, Container, alpha, IconButton } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme';

function TermsOfServicePage() {
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
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: colors.background.main,
        py: 4,
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
              Terms of Service
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
            Last updated: January 2025
          </Typography>

          <Section title="1. Acceptance of Terms">
            By accessing or using Gift Guru ("the Service"), you agree to be bound by these Terms of Service.
            If you do not agree to these terms, please do not use the Service.
          </Section>

          <Section title="2. Description of Service">
            Gift Guru is a wishlist management platform that allows users to create, manage, and share
            wishlists with friends and family. The Service enables gift coordination by allowing shared
            users to claim items without revealing claims to list owners.
          </Section>

          <Section title="3. User Accounts">
            You must sign in using Google OAuth to use the Service. You are responsible for maintaining
            the security of your Google account. You agree to provide accurate information and to update
            it as necessary. You may not use the Service for any illegal or unauthorized purpose.
          </Section>

          <Section title="4. User Content">
            You retain ownership of any content you create on the Service, including wishlists and items.
            By using the Service, you grant us a limited license to store and display your content as
            necessary to provide the Service. You are solely responsible for the content you create and share.
          </Section>

          <Section title="5. Acceptable Use">
            You agree not to: (a) use the Service to harass, abuse, or harm others; (b) upload malicious
            content or attempt to compromise the Service; (c) use automated systems to access the Service
            without permission; (d) impersonate others or misrepresent your affiliation; or (e) violate
            any applicable laws or regulations.
          </Section>

          <Section title="6. Privacy">
            Your use of the Service is also governed by our privacy practices. We collect your email
            address, name, and profile picture from Google OAuth for account creation. We store your
            wishlists and sharing preferences. We do not sell your personal information to third parties.
          </Section>

          <Section title="7. Disclaimer of Warranties">
            The Service is provided "as is" and "as available" without warranties of any kind, either
            express or implied. We do not guarantee that the Service will be uninterrupted, secure, or
            error-free. We are not responsible for any purchases made based on wishlist information.
          </Section>

          <Section title="8. Limitation of Liability">
            To the maximum extent permitted by law, Gift Guru and its operators shall not be liable for
            any indirect, incidental, special, consequential, or punitive damages, or any loss of profits
            or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or
            other intangible losses resulting from your use of the Service.
          </Section>

          <Section title="9. Changes to Terms">
            We reserve the right to modify these terms at any time. We will notify users of significant
            changes by updating the "Last updated" date. Your continued use of the Service after changes
            constitutes acceptance of the new terms.
          </Section>

          <Section title="10. Termination">
            We may terminate or suspend your access to the Service at any time, without prior notice,
            for conduct that we believe violates these Terms or is harmful to other users, us, or third
            parties, or for any other reason at our sole discretion.
          </Section>

          <Section title="11. Contact">
            If you have any questions about these Terms of Service, please contact us through the
            GitHub repository at github.com/hscopalm/shareable-wishlists.
          </Section>
        </Box>
      </Container>
    </Box>
  );
}

export default TermsOfServicePage;
