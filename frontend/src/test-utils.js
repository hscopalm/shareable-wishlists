import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from './theme';
import { AuthContext } from './contexts/AuthContext';
import { ListContext } from './contexts/ListContext';

// Sensible no-op defaults for each context so a test only has to override
// the values it actually cares about.
const defaultAuthValue = {
  user: null,
  loading: false,
  login: () => {},
  logout: () => {},
  refreshAuth: () => {},
  getPostLoginRedirect: () => null,
};

const defaultListValue = {
  lists: [],
  setLists: () => {},
  currentList: null,
  setCurrentList: () => {},
  isSharedList: false,
  setIsSharedList: () => {},
  loading: false,
  refreshLists: () => {},
};

/**
 * Renders ui inside ThemeProvider + MemoryRouter + Auth/List context
 * providers, bypassing AuthProvider/ListProvider (and their real API calls)
 * so component/page tests can inject exactly the auth/list state they need.
 *
 * @param {React.ReactElement} ui
 * @param {object} [options]
 * @param {object} [options.authValue] - merged over defaultAuthValue
 * @param {object} [options.listValue] - merged over defaultListValue
 * @param {string|string[]} [options.route] - MemoryRouter initialEntries (default '/')
 * @param {import('@testing-library/react').RenderOptions} [options.renderOptions]
 */
export function renderWithProviders(ui, {
  authValue = {},
  listValue = {},
  route = '/',
  ...renderOptions
} = {}) {
  const mergedAuthValue = { ...defaultAuthValue, ...authValue };
  const mergedListValue = { ...defaultListValue, ...listValue };
  const initialEntries = Array.isArray(route) ? route : [route];

  function Wrapper({ children }) {
    return (
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthContext.Provider value={mergedAuthValue}>
            <ListContext.Provider value={mergedListValue}>
              {children}
            </ListContext.Provider>
          </AuthContext.Provider>
        </MemoryRouter>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from RTL so tests only need one import source.
export * from '@testing-library/react';
