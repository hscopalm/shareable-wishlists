import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../test-utils';
import WishlistItem from './WishlistItem';

const baseItem = {
  _id: 'item-1',
  title: 'Espresso Machine',
  link: 'https://example.com/espresso',
  quantity: 1,
};

describe('WishlistItem — owner view', () => {
  it('calls onEdit when the card is clicked, and never opens the link', async () => {
    const onEdit = jest.fn();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});

    renderWithProviders(<WishlistItem item={baseItem} isSharedList={false} onEdit={onEdit} />);

    await userEvent.click(screen.getByText('Espresso Machine'));

    expect(onEdit).toHaveBeenCalledWith(baseItem);
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });
});

describe('WishlistItem — shared list view', () => {
  it('opens the item link in a new tab when the card is clicked, without calling onEdit', async () => {
    const onEdit = jest.fn();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});

    renderWithProviders(<WishlistItem item={baseItem} isSharedList={true} onEdit={onEdit} />);

    await userEvent.click(screen.getByText('Espresso Machine'));

    expect(openSpy).toHaveBeenCalledWith(baseItem.link, '_blank');
    expect(onEdit).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it('calls onClaim (not onEdit or window.open) when the claim button is clicked', async () => {
    const onClaim = jest.fn();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});

    renderWithProviders(<WishlistItem item={baseItem} isSharedList={true} onClaim={onClaim} />);

    // Mobile and desktop layouts both render a "Claim" button; either works.
    const [claimButton] = screen.getAllByRole('button', { name: /^claim$/i });
    await userEvent.click(claimButton);

    expect(onClaim).toHaveBeenCalledWith(baseItem);
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it('shows who claimed a legacy single-mode item', () => {
    const claimedItem = {
      ...baseItem,
      status: { claimedBy: { _id: 'other-user', name: 'Jordan' } },
    };

    renderWithProviders(
      <WishlistItem item={claimedItem} isSharedList={true} onClaim={() => {}} />,
      { authValue: { user: { _id: 'me' } } }
    );

    expect(screen.getByText('Claimed by')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument(); // avatar fallback initial
  });

  it('shows "You claimed this" when the current viewer is the claimer', () => {
    const claimedItem = {
      ...baseItem,
      status: { claimedBy: { _id: 'me', name: 'Me' } },
    };

    renderWithProviders(
      <WishlistItem item={claimedItem} isSharedList={true} onClaim={() => {}} />,
      { authValue: { user: { _id: 'me' } } }
    );

    expect(screen.getByText('You claimed this')).toBeInTheDocument();
  });
});
