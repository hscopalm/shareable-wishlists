import { createTheme, alpha } from '@mui/material';

// Modern color palette with purple/violet accents
const colors = {
  primary: '#8B5CF6', // Violet
  primaryLight: '#A78BFA',
  primaryDark: '#7C3AED',
  secondary: '#EC4899', // Pink
  accent: '#06B6D4', // Cyan
  success: '#10B981', // Emerald
  warning: '#F59E0B', // Amber
  error: '#EF4444', // Red
  background: {
    main: '#0F0F1A', // Deep dark
    elevated: '#1A1A2E', // Slightly lighter
    card: '#16162A', // Card background
    glass: 'rgba(26, 26, 46, 0.7)', // Glass effect
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
  },
  border: 'rgba(139, 92, 246, 0.15)',
  borderHover: 'rgba(139, 92, 246, 0.3)',
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary,
      light: colors.primaryLight,
      dark: colors.primaryDark,
    },
    secondary: {
      main: colors.secondary,
    },
    error: {
      main: colors.error,
    },
    warning: {
      main: colors.warning,
    },
    success: {
      main: colors.success,
    },
    info: {
      main: colors.accent,
    },
    background: {
      default: colors.background.main,
      paper: colors.background.elevated,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
    },
    divider: colors.border,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.primary} ${colors.background.main}`,
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: colors.background.main,
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(colors.primary, 0.3),
            borderRadius: '4px',
            '&:hover': {
              background: alpha(colors.primary, 0.5),
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.card,
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          boxShadow: 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            borderColor: colors.borderHover,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 20px',
          transition: 'all 0.2s ease-in-out',
        },
        contained: {
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
          boxShadow: `0 4px 15px ${alpha(colors.primary, 0.4)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.primary} 100%)`,
            boxShadow: `0 6px 20px ${alpha(colors.primary, 0.5)}`,
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderColor: alpha(colors.primary, 0.5),
          '&:hover': {
            borderColor: colors.primary,
            backgroundColor: alpha(colors.primary, 0.1),
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.background.elevated,
          borderRadius: 20,
          border: `1px solid ${colors.border}`,
          backdropFilter: 'blur(20px)',
          boxShadow: `0 25px 50px -12px ${alpha('#000', 0.5)}`,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.5rem',
          fontWeight: 700,
          paddingBottom: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          fontSize: '0.75rem',
        },
        outlined: {
          borderWidth: '1.5px',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: alpha(colors.background.main, 0.5),
            '& fieldset': {
              borderColor: colors.border,
              transition: 'all 0.2s ease-in-out',
            },
            '&:hover fieldset': {
              borderColor: alpha(colors.primary, 0.5),
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary,
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: `0 4px 20px ${alpha('#000', 0.3)}`,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          border: `2px solid ${alpha(colors.primary, 0.5)}`,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: alpha(colors.primary, 0.15),
            transform: 'scale(1.05)',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.background.elevated,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          fontSize: '0.8rem',
          padding: '8px 12px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(colors.primary, 0.1),
        },
      },
    },
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
    body1: {
      lineHeight: 1.7,
    },
    body2: {
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
});

// Export colors for use in components
export { colors };
