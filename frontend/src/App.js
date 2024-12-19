import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container, CssBaseline, ThemeProvider } from '@mui/material';
import WishlistPage from './pages/WishlistPage';
import Navbar from './components/Navbar';
import { theme } from './theme';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div style={{ backgroundColor: '#1E1E2E', minHeight: '100vh' }}>
          <Navbar />
          <Container maxWidth="lg" sx={{ pt: 4, pb: 8 }}>
            <Routes>
              <Route path="/" element={<WishlistPage />} />
            </Routes>
          </Container>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App; 