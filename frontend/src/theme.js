import { createTheme } from '@mui/material';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4CAF50', // Vivid Green
    },
    secondary: {
      main: '#FF9800', // Amber
    },
    error: {
      main: '#F44336', // Red
    },
    action: {
      main: '#2196F3', // Bright Blue
    },
    background: {
      default: '#1E1E2E', // Dark Grayish Blue
      paper: '#2E3440', // Lighter Shade for Cards
    },
    text: {
      primary: '#FFFFFF', // White
      secondary: '#B0BEC5', // Light Slate Gray
    },
    divider: '#3A3F4B', // Muted Dark Gray
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#2E3440',
          borderRadius: 12,
          border: '1px solid #3A3F4B',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#2E3440',
          borderRadius: 12,
          border: '1px solid #3A3F4B',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
}); 