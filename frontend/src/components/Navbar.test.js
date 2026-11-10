import React from 'react';
import { renderWithProviders, screen } from '../test-utils';
import Navbar from './Navbar';

const baseUser = { name: 'Alice', email: 'alice@test.com' };

test('hides the Connect AI link when MCP is disabled', () => {
  renderWithProviders(<Navbar />, { authValue: { user: { ...baseUser, mcpEnabled: false } } });
  expect(screen.getByText('My Lists')).toBeInTheDocument();
  expect(screen.queryByText('Connect AI')).not.toBeInTheDocument();
});

test('shows the Connect AI link when MCP is enabled', () => {
  renderWithProviders(<Navbar />, { authValue: { user: { ...baseUser, mcpEnabled: true } } });
  expect(screen.getByText('Connect AI')).toBeInTheDocument();
});
