import { Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../test-utils';
import InvitePage from './InvitePage';

jest.mock('../services/api');
// eslint-disable-next-line import/first
import { getPublicList, claimItemPublic } from '../services/api';

function renderInvite(items) {
  getPublicList.mockResolvedValue({
    list: { _id: 'list-1', name: "Sam's Birthday", allowAnonymousClaims: false },
    items,
    viewer: { isAuthenticated: true, isSharedWith: false },
  });
  return renderWithProviders(
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
    </Routes>,
    {
      route: '/invite/tok-1',
      authValue: { user: { _id: 'me', name: 'Me' } },
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Issue #43: the server used to toggle based on a stale read, so a double
// click or concurrent change could turn "Claim" into an unclaim. The page
// must send what the user actually clicked.
describe('InvitePage — explicit claim intent', () => {
  it('sends quantity 1 when the user clicks Claim', async () => {
    claimItemPublic.mockResolvedValue({
      status: { claimedBy: { _id: 'me', name: 'Me' } },
      claims: [{ claimedBy: { _id: 'me', name: 'Me' }, quantity: 1 }],
      quantity: 1,
    });
    renderInvite([{ _id: 'item-1', title: 'Board Game', quantity: 1 }]);

    await screen.findByText('Board Game');
    const [claimButton] = screen.getAllByRole('button', { name: /^claim$/i });
    await userEvent.click(claimButton);

    await waitFor(() => {
      expect(claimItemPublic).toHaveBeenCalledWith('tok-1', 'item-1', { quantity: 1 });
    });
  });

  it('sends quantity 0 when the user clicks Unclaim on their own claim', async () => {
    localStorage.setItem('showClaimedItems', 'true');
    claimItemPublic.mockResolvedValue({ status: {}, claims: [], quantity: 1 });
    renderInvite([{
      _id: 'item-1',
      title: 'Board Game',
      quantity: 1,
      status: { claimedBy: { _id: 'me', name: 'Me' } },
      claims: [{ claimedBy: { _id: 'me', name: 'Me' }, quantity: 1 }],
    }]);

    await screen.findByText('Board Game');
    const [unclaimButton] = screen.getAllByRole('button', { name: /^unclaim$/i });
    await userEvent.click(unclaimButton);

    await waitFor(() => {
      expect(claimItemPublic).toHaveBeenCalledWith('tok-1', 'item-1', { quantity: 0 });
    });
  });
});
