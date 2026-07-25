import { Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../test-utils';
import WishlistPage from './WishlistPage';

jest.mock('../services/api');
// eslint-disable-next-line import/first
import { fetchListItems, claimItem } from '../services/api';

const mockItem = {
  _id: 'item-1',
  title: 'Board Game',
  link: 'https://example.com/game',
  quantity: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
};

function renderSharedList(overrides = {}) {
  return renderWithProviders(
    <Routes>
      <Route path="/list/:id" element={<WishlistPage />} />
    </Routes>,
    {
      route: '/list/list-1',
      authValue: { user: { _id: 'me', name: 'Me' } },
      listValue: { isSharedList: true, setCurrentList: jest.fn() },
      ...overrides,
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  fetchListItems.mockResolvedValue({
    items: [mockItem],
    list: { _id: 'list-1', name: "Sam's Birthday" },
    isShared: true,
  });
});

// Mirrors CLAUDE.md's backend testing philosophy applied to the frontend:
// this is the "critical user flow" for a shared list — load it, claim
// something, see it reflected — not an implementation-detail test.
describe('WishlistPage — shared list critical flow', () => {
  it('loads items for the list id in the route and renders them', async () => {
    renderSharedList();

    expect(await screen.findByText('Board Game')).toBeInTheDocument();
    expect(fetchListItems).toHaveBeenCalledWith('list-1');
  });

  it('claiming an item calls the claim API and reflects the claimed state', async () => {
    claimItem.mockResolvedValue({
      status: { claimedBy: { _id: 'me', name: 'Me' } },
      claims: [],
      quantity: 1,
    });

    renderSharedList();
    await screen.findByText('Board Game');

    const [claimButton] = screen.getAllByRole('button', { name: /^claim$/i });
    await userEvent.click(claimButton);

    await waitFor(() => {
      expect(claimItem).toHaveBeenCalledWith('list-1', 'item-1');
    });

    // The exact-label "Claim" button is gone once the item is claimed —
    // only "Unclaim" remains for whoever holds the claim.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^claim$/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/1 claimed item/i)).toBeInTheDocument();
  });

  it('leaves the item claimable if the claim request fails, instead of crashing the page', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    claimItem.mockRejectedValue({ response: { data: { message: 'Someone beat you to it' } } });

    renderSharedList();
    await screen.findByText('Board Game');

    const [claimButton] = screen.getAllByRole('button', { name: /^claim$/i });
    await userEvent.click(claimButton);

    await waitFor(() => expect(claimItem).toHaveBeenCalled());

    // handleClaimItem only logs on error for single-mode items today; the
    // item should remain visible and still claimable rather than the page
    // blowing up or silently marking it claimed.
    expect(await screen.findByText('Board Game')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^claim$/i }).length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });
});

describe('WishlistPage — owner view', () => {
  it('does not fetch a claimed/unclaimed split and shows the Add Item action', async () => {
    renderSharedList({ listValue: { isSharedList: false, setCurrentList: jest.fn() } });

    expect(await screen.findByText('Board Game')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^claim$/i })).not.toBeInTheDocument();
  });
});
