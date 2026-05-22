import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Container, CssBaseline, ThemeProvider, CircularProgress, Box, alpha } from '@mui/material';
import WishlistPage from './pages/WishlistPage';
import LandingPage from './pages/LandingPage';
import Navbar from './components/Navbar';
import { theme, colors } from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SharedListsPage from './pages/SharedListsPage';
import { ListProvider } from './contexts/ListContext';
import ListsPage from './pages/ListsPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import InvitePage from './pages/InvitePage';

const LoadingSpinner = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: colors.background.main,
    }}
  >
    <CircularProgress
      sx={{
        color: colors.primary,
        '& .MuiCircularProgress-circle': {
          strokeLinecap: 'round',
        },
      }}
      size={48}
      thickness={4}
    />
  </Box>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  return children;
};

// App chrome for authenticated pages: background glow, navbar, content container.
// The public landing page renders outside this shell so it can run full-bleed.
const Shell = ({ children }) => {
  const { user } = useAuth();

  return (
    <Box
      sx={{
        backgroundColor: colors.background.main,
        minHeight: '100vh',
        position: 'relative',
        '&::before': user ? {
          content: '""',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '50vh',
          background: `radial-gradient(ellipse at 50% 0%, ${alpha(colors.primary, 0.08)} 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        } : {},
      }}
    >
      {user && <Navbar />}
      <Container
        maxWidth="lg"
        sx={{
          position: 'relative',
          zIndex: 1,
          pt: { xs: 3, sm: 4 },
          pb: { xs: 6, sm: 10 },
          px: { xs: 2, sm: 3 },
        }}
      >
        {children}
      </Container>
    </Box>
  );
};

function PostLoginRedirect() {
  const navigate = useNavigate();
  const { getPostLoginRedirect } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!checked) {
      const redirect = getPostLoginRedirect();
      if (redirect) {
        navigate(redirect, { replace: true });
      }
      setChecked(true);
    }
  }, [checked, getPostLoginRedirect, navigate]);

  return null;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        {user && <PostLoginRedirect />}
        <Routes>
          {/* /login is retired — the landing page carries sign-in inline */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/terms" element={<Shell><TermsOfServicePage /></Shell>} />
          <Route path="/invite/:token" element={<Shell><InvitePage /></Shell>} />
          <Route
            path="/"
            element={user ? <Shell><ListsPage /></Shell> : <LandingPage />}
          />
          <Route path="/list/:id" element={
            <ProtectedRoute>
              <Shell><WishlistPage /></Shell>
            </ProtectedRoute>
          } />
          <Route path="/shared" element={
            <ProtectedRoute>
              <Shell><SharedListsPage /></Shell>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ListProvider>
        <AppContent />
      </ListProvider>
    </AuthProvider>
  );
}

export default App;
