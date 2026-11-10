const Wishlist = require('../../../models/Wishlist');
const { createUser } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');
const invites = require('../../../services/invites');
const { claimViaInvite } = require('../../../services/publicClaims');
const { NotFoundError, UnauthorizedError, ValidationError } = require('../../../services/errors');

async function setup(item, overrides = {}) {
  const owner = await createUser();
  const bob = await createUser();
  const list = await createWishlist(owner, { items: [item], ...overrides });
  const { token } = await invites.createInviteLink({ userId: owner._id, listId: list._id });
  return { owner, bob, list, token, itemId: list.items[0]._id.toString() };
}

describe('invite link lifecycle', () => {
  it('only the owner can manage the link', async () => {
    const { bob, list } = await setup({ title: 'Book' });
    await expect(invites.createInviteLink({ userId: bob._id, listId: list._id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(invites.disableInviteLink({ userId: bob._id, listId: list._id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(invites.setAnonymousClaims({ userId: bob._id, listId: list._id, allow: true })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('regenerating invalidates the old token', async () => {
    const { owner, bob, list, token } = await setup({ title: 'Book' });
    const next = await invites.createInviteLink({ userId: owner._id, listId: list._id });
    expect(next.token).not.toBe(token);
    await expect(invites.viewInvite({ token, userId: null })).rejects.toBeInstanceOf(NotFoundError);
    await expect(invites.joinInvite({ token, userId: bob._id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(invites.viewInvite({ token: next.token, userId: null })).resolves.toBeTruthy();
  });

  it('a disabled link rejects view, join and claim', async () => {
    const { owner, bob, list, token, itemId } = await setup({ title: 'Book' });
    await invites.disableInviteLink({ userId: owner._id, listId: list._id });
    await expect(invites.viewInvite({ token, userId: null })).rejects.toBeInstanceOf(NotFoundError);
    await expect(invites.joinInvite({ token, userId: bob._id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(claimViaInvite({ token, itemId, userId: bob._id })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('joinInvite', () => {
  it('requires sign-in, rejects the owner, and is idempotent', async () => {
    const { owner, bob, list, token } = await setup({ title: 'Book' });
    await expect(invites.joinInvite({ token, userId: null })).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(invites.joinInvite({ token, userId: owner._id })).rejects.toBeInstanceOf(ValidationError);
    await invites.joinInvite({ token, userId: bob._id });
    await invites.joinInvite({ token, userId: bob._id });
    expect((await Wishlist.findById(list._id)).sharedWith).toHaveLength(1);
  });
});

describe('claimViaInvite', () => {
  it('rejects anonymous claims unless the owner allows them', async () => {
    const { owner, list, token, itemId } = await setup({ title: 'Book' });
    await expect(claimViaInvite({ token, itemId, userId: null, claimerName: 'Gran' }))
      .rejects.toMatchObject({ status: 401 });

    await invites.setAnonymousClaims({ userId: owner._id, listId: list._id, allow: true });
    await expect(claimViaInvite({ token, itemId, userId: null, claimerName: '  ' }))
      .rejects.toMatchObject({ status: 400, message: 'Name is required for anonymous claims' });
    const out = await claimViaInvite({ token, itemId, userId: null, claimerName: ' Gran ' });
    expect(out.isAnonymousClaim).toBe(true);
    expect(out.claims[0].claimedBy.name).toBe('Gran');

    // A second anonymous claim on a single item is a conflict (HTTP 400).
    await expect(claimViaInvite({ token, itemId, userId: null, claimerName: 'Other' }))
      .rejects.toMatchObject({ status: 400, message: 'Item already claimed' });

    await invites.setAnonymousClaims({ userId: owner._id, listId: list._id, allow: false });
    await expect(claimViaInvite({ token, itemId, userId: null, claimerName: 'Late' }))
      .rejects.toMatchObject({ status: 401 });
  });

  it('owner cannot claim on their own list via the link', async () => {
    const { owner, token, itemId } = await setup({ title: 'Book' });
    await expect(claimViaInvite({ token, itemId, userId: owner._id }))
      .rejects.toMatchObject({ status: 400, message: 'Cannot claim items on your own list' });
  });

  it('an authed claim also adds the user to sharedWith', async () => {
    const { bob, list, token, itemId } = await setup({ title: 'Book' });
    const out = await claimViaInvite({ token, itemId, userId: bob._id });
    expect(out.claims).toHaveLength(1);
    expect((await Wishlist.findById(list._id)).sharedWith.map(String)).toContain(bob._id.toString());
  });

  it('anonymous multi claims respect capacity', async () => {
    const { owner, list, token, itemId } = await setup({ title: 'Socks', quantity: 2 }, { allowAnonymousClaims: true });
    await claimViaInvite({ token, itemId, userId: null, claimerName: 'A', quantity: 2 });
    await expect(claimViaInvite({ token, itemId, userId: null, claimerName: 'B', quantity: 1 }))
      .rejects.toMatchObject({ status: 400, message: 'Only 0 remaining of 2' });
  });

  it('cash items accept repeated anonymous contributions but authed users toggle', async () => {
    const { bob, token, itemId } = await setup(
      { type: 'cash', title: 'Cash', paymentLinks: { venmo: 'x' } },
      { allowAnonymousClaims: true }
    );
    await claimViaInvite({ token, itemId, userId: null, claimerName: 'A' });
    const two = await claimViaInvite({ token, itemId, userId: null, claimerName: 'A' });
    expect(two.claims).toHaveLength(2);
    expect((await claimViaInvite({ token, itemId, userId: bob._id })).claims).toHaveLength(3);
    expect((await claimViaInvite({ token, itemId, userId: bob._id })).claims).toHaveLength(2);
  });
});

describe('viewInvite', () => {
  it('hides claimer identity details for anonymous claims and reports viewer flags', async () => {
    const { owner, bob, token, itemId } = await setup({ title: 'Book' }, { allowAnonymousClaims: true });
    await claimViaInvite({ token, itemId, userId: null, claimerName: 'Gran' });
    const view = await invites.viewInvite({ token, userId: owner._id });
    expect(view.viewer).toMatchObject({ isAuthenticated: true, isOwner: true });
    expect(view.items[0].claims).toEqual([]);
    const anon = await invites.viewInvite({ token, userId: null });
    expect(anon.viewer.isAuthenticated).toBe(false);
    expect(anon.items[0].claims[0].claimedBy.picture).toBeNull();
  });
});
