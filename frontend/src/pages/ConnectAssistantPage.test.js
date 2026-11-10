import React from 'react';
import { renderWithProviders, screen, waitFor, within } from '../test-utils';
import userEvent from '@testing-library/user-event';
import ConnectAssistantPage from './ConnectAssistantPage';
import {
  listMcpTokens,
  createMcpToken,
  revokeMcpToken,
  revokeMcpConnection,
} from '../services/api';

jest.mock('../services/api');

const existing = {
  tokens: [
    {
      id: 'tok1',
      name: 'Laptop',
      prefix: 'gg_pat_ab12',
      scopes: ['wishlists'],
      createdAt: '2026-11-01T00:00:00Z',
      lastUsedAt: null,
    },
  ],
  connections: [
    {
      clientId: 'client1',
      clientName: 'Claude',
      scopes: ['wishlists:read'],
      createdAt: '2026-11-01T00:00:00Z',
      lastUsedAt: null,
    },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
  listMcpTokens.mockResolvedValue(existing);
});

test('shows the new token once and drops it after dismissal', async () => {
  createMcpToken.mockResolvedValue({
    token: 'gg_pat_SECRETVALUE',
    id: 'tok2',
    name: 'Phone',
    prefix: 'gg_pat_zz99',
    scopes: ['wishlists'],
  });
  renderWithProviders(<ConnectAssistantPage />);
  await screen.findByText('Laptop');

  await userEvent.type(screen.getByLabelText('Token name'), 'Phone');
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }));

  expect(await screen.findByText('gg_pat_SECRETVALUE')).toBeInTheDocument();
  expect(createMcpToken).toHaveBeenCalledWith('Phone', 'wishlists');

  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(screen.queryByText('gg_pat_SECRETVALUE')).not.toBeInTheDocument();
});

test('read-only checkbox sends the read scope', async () => {
  createMcpToken.mockResolvedValue({ token: 't', id: 'x', name: 'n', prefix: 'p', scopes: [] });
  renderWithProviders(<ConnectAssistantPage />);
  await screen.findByText('Laptop');

  await userEvent.type(screen.getByLabelText('Token name'), 'Viewer');
  await userEvent.click(screen.getByLabelText('Read-only'));
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }));

  await waitFor(() => expect(createMcpToken).toHaveBeenCalledWith('Viewer', 'wishlists:read'));
});

test('revoking a token needs confirmation and then calls the api', async () => {
  revokeMcpToken.mockResolvedValue({});
  renderWithProviders(<ConnectAssistantPage />);
  await screen.findByText('Laptop');

  await userEvent.click(screen.getByRole('button', { name: 'Revoke Laptop' }));
  expect(revokeMcpToken).not.toHaveBeenCalled();

  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

  await waitFor(() => expect(revokeMcpToken).toHaveBeenCalledWith('tok1'));
});

test('revoking a connected app calls the connection endpoint', async () => {
  revokeMcpConnection.mockResolvedValue({});
  renderWithProviders(<ConnectAssistantPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Revoke Claude' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

  await waitFor(() => expect(revokeMcpConnection).toHaveBeenCalledWith('client1'));
});
