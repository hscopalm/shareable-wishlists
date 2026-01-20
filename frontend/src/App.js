import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container, CssBaseline, ThemeProvider, CircularProgress, Box, alpha } from '@mui/material';
import WishlistPage from './pages/WishlistPage';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Navbar';
import { theme, colors } from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SharedListsPage from './pages/SharedListsPage';
import { ListProvider } from './contexts/ListContext';
import ListsPage from './pages/ListsPage';

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
    return <Navigate to="/login" />;
  }

  return children;
};

function AppContent() {
  const { user, loading } = useAuth();

  const LoginWrapper = () => {
    return user ? <Navigate to="/" /> : <LoginPage />;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
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
            <Routes>
              <Route path="/login" element={<LoginWrapper />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <ListsPage />
                </ProtectedRoute>
              } />
              <Route path="/list/:id" element={
                <ProtectedRoute>
                  <WishlistPage />
                </ProtectedRoute>
              } />
              <Route path="/shared" element={
                <ProtectedRoute>
                  <SharedListsPage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Container>
        </Box>
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
