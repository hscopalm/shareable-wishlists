import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container, CssBaseline, ThemeProvider, CircularProgress, Box } from '@mui/material';
import WishlistPage from './pages/WishlistPage';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Navbar';
import { theme } from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SharedListsPage from './pages/SharedListsPage';
import SharedListPage from './pages/SharedListPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
};

function AppContent() {
  const { user, loading } = useAuth();

  // Redirect to home if user is logged in and tries to access login page
  const LoginWrapper = () => {
    return user ? <Navigate to="/" /> : <LoginPage />;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div style={{ backgroundColor: '#1E1E2E', minHeight: '100vh' }}>
          {user && <Navbar />}
          <Container maxWidth="lg" sx={{ pt: 4, pb: 8 }}>
            <Routes>
              <Route path="/login" element={<LoginWrapper />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <WishlistPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shared"
                element={
                  <ProtectedRoute>
                    <SharedListsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shared/:userId"
                element={
                  <ProtectedRoute>
                    <SharedListPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Container>
        </div>
      </Router>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App; 