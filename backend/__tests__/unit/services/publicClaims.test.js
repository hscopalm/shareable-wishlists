const Wishlist = require('../../../models/Wishlist');
const { createUser } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');
const invites = require('../../../services/invites');
const { claimViaInvite } = require('../../../services/publicClaims');

async function setup(item, overrides = {}) {
  const owner = await createUser();
  const bob = await createUser();
  const carol = await createUser();
  const list = await createWishlist(owner, { items: [item], ...overrides });
  const { token } = await invites.createInviteLink({ userId: owner._id, listId: list._id });
  return { owner, bob, carol, list, token, itemId: list.items[0]._id.toString() };
}

const sum = out => out.claims.reduce((s, c) => s + c.quantity, 0);

describe('authed single-mode claims', () => {
  it('claims, then toggles to unclaim', async () => {
    const { bob, token, itemId } = await setup({ title: 'Book' });
    const claimed = await claimViaInvite({ token, itemId, userId: bob._id });
    expect(claimed.isClaimed).toBe(true);
    expect(claimed.claims[0].claimedBy._id.toString()).toBe(bob._id.toString());
    const unclaimed = await claimViaInvite({ token, itemId, userId: bob._id });
    expect(unclaimed.isClaimed).toBe(false);
    expect(unclaimed.status).toEqual({});
  });

  it('explicit quantity 0 unclaims and quantity > 1 is rejected', async () => {
    const { bob, token, itemId } = await setup({ title: 'Book' });
    await claimViaInvite({ token, itemId, userId: bob._id, quantity: 1 });
    expect((await claimViaInvite({ token, itemId, userId: bob._id, quantity: 0 })).isClaimed).toBe(false);
    await expect(claimViaInvite({ token, itemId, userId: bob._id, quantity: 2 }))
      .rejects.toMatchObject({ status: 400, message: 'This item only allows a single claim' });
    await expect(claimViaInvite({ token, itemId, userId: bob._id, quantity: -1 }))
      .rejects.toMatchObject({ status: 400, message: 'Quantity must be a non-negative integer' });
  });

  it('returns 400 when someone else holds it and leaves their claim', async () => {
    const { bob, carol, token, itemId } = await setup({ title: 'Book' });
    await claimViaInvite({ token, itemId, userId: bob._id });
    await expect(claimViaInvite({ token, itemId, userId: carol._id }))
      .rejects.toMatchObject({ status: 400, message: 'Item already claimed by someone else' });
    // Unclaim by a non-holder is an idempotent no-op that keeps Bob's claim.
    const out = await claimViaInvite({ token, itemId, userId: carol._id, quantity: 0 });
    expect(out.claims[0].claimedBy._id.toString()).toBe(bob._id.toString());
  });

  it('owner cannot claim their own item', async () => {
    const { owner, token, itemId } = await setup({ title: 'Book' });
    await expect(claimViaInvite({ token, itemId, userId: owner._id }))
      .rejects.toMatchObject({ status: 400, message: 'Cannot claim items on your own list' });
  });

  it('adds the claimer to sharedWith', async () => {
    const { bob, list, token, itemId } = await setup({ title: 'Book' });
    await claimViaInvite({ token, itemId, userId: bob._id });
    expect((await Wishlist.findById(list._id)).sharedWith.map(String)).toContain(bob._id.toString());
  });

  it('404s for an unknown item', async () => {
    const { bob, token } = await setup({ title: 'Book' });
    await expect(claimViaInvite({ token, itemId: '507f1f77bcf86cd799439011', userId: bob._id }))
      .rejects.toMatchObject({ status: 404, message: 'Item not found' });
  });
});

describe('authed single-mode explicit intent (#43)', () => {
  const holder = out => out.claims[0]?.claimedBy._id.toString();

  it('explicit claim on an item someone else holds conflicts and keeps their claim', async () => {
    const { bob, carol, token, itemId, list } = await setup({ title: 'Book' });
    await claimViaInvite({ token, itemId, userId: bob._id, quantity: 1 });
    await expect(claimViaInvite({ token, itemId, userId: carol._id, quantity: 1 }))
      .rejects.toMatchObject({ status: 400, message: 'Item already claimed by someone else' });
    const item = (await Wishlist.findById(list._id)).items[0];
    expect(item.status.claimedBy.toString()).toBe(bob._id.toString());
  });

  it('explicit claim is idempotent: claiming twice leaves it claimed', async () => {
    const { bob, token, itemId } = await setup({ title: 'Book' });
    await claimViaInvite({ token, itemId, userId: bob._id, quantity: 1 });
    const again = await claimViaInvite({ token, itemId, userId: bob._id, quantity: 1 });
    expect(again.isClaimed).toBe(true);
    expect(holder(again)).toBe(bob._id.toString());
  });

  it('concurrent explicit claims from the same user (double click) never unclaim', async () => {
    const { bob, token, itemId, list } = await setup({ title: 'Book' });
    const results = await Promise.allSettled([
      claimViaInvite({ token, itemId, userId: bob._id, quantity: 1 }),
      claimViaInvite({ token, itemId, userId: bob._id, quantity: 1 })
    ]);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    const item = (await Wishlist.findById(list._id)).items[0];
    expect(item.status.claimedBy.toString()).toBe(bob._id.toString());
  });

  it('explicit unclaim is idempotent, never claims, and only clears my own claim', async () => {
    const { bob, carol, token, itemId } = await setup({ title: 'Book' });
    expect((await claimViaInvite({ token, itemId, userId: bob._id, quantity: 0 })).isClaimed).toBe(false);
    expect((await claimViaInvite({ token, itemId, userId: bob._id, quantity: 0 })).isClaimed).toBe(false);

    await claimViaInvite({ token, itemId, userId: carol._id, quantity: 1 });
    const out = await claimViaInvite({ token, itemId, userId: bob._id, quantity: 0 });
    expect(holder(out)).toBe(carol._id.toString());
  });

  it('legacy no-quantity requests still toggle', async () => {
    const { bob, token, itemId } = await setup({ title: 'Book' });
    expect((await claimViaInvite({ token, itemId, userId: bob._id })).isClaimed).toBe(true);
    expect((await claimViaInvite({ token, itemId, userId: bob._id })).isClaimed).toBe(false);
  });
});

describe('authed multi-mode claims', () => {
  it('handles exactly full, over capacity, and reducing own claim', async () => {
    const { bob, carol, list, token, itemId } = await setup({ title: 'Socks', quantity: 3 });
    await claimViaInvite({ token, itemId, userId: bob._id, quantity: 2 });
    const full = await claimViaInvite({ token, itemId, userId: carol._id, quantity: 1 });
    expect(sum(full)).toBe(3);

    await expect(claimViaInvite({ token, itemId, userId: carol._id, quantity: 2 }))
      .rejects.toMatchObject({ status: 400, message: 'Only 1 remaining of 3' });

    const reduced = await claimViaInvite({ token, itemId, userId: bob._id, quantity: 1 });
    expect(sum(reduced)).toBe(2);
    const carolMore = await claimViaInvite({ token, itemId, userId: carol._id, quantity: 2 });
    expect(sum(carolMore)).toBe(3);
    expect((await Wishlist.findById(list._id)).sharedWith).toHaveLength(2);
  });

  it('quantity 0 removes only my claim; missing quantity claims one', async () => {
    const { bob, carol, token, itemId } = await setup({ title: 'Socks', quantity: 3 });
    await claimViaInvite({ token, itemId, userId: bob._id, quantity: 2 });
    expect((await claimViaInvite({ token, itemId, userId: carol._id })).claims).toHaveLength(2);
    const after = await claimViaInvite({ token, itemId, userId: bob._id, quantity: 0 });
    expect(after.claims).toHaveLength(1);
    expect(after.claims[0].quantity).toBe(1);
  });
});

describe('anonymous claims', () => {
  it('claims a single item with a trimmed name and hides identity', async () => {
    const { token, itemId } = await setup({ title: 'Book' }, { allowAnonymousClaims: true });
    const out = await claimViaInvite({ token, itemId, userId: null, claimerName: ' Gran ' });
    expect(out.isAnonymousClaim).toBe(true);
    expect(out.status.claimedBy.name).toBe('Gran');
    expect(out.claims[0].claimedBy.picture).toBeNull();
  });

  it('is blocked with 401 when the list does not allow anonymous claims', async () => {
    const { token, itemId } = await setup({ title: 'Book' });
    await expect(claimViaInvite({ token, itemId, userId: null, claimerName: 'Gran' }))
      .rejects.toMatchObject({ status: 401, message: 'Sign in to claim items' });
  });

  it('requires a name (blank or non-string)', async () => {
    const { token, itemId } = await setup({ title: 'Book' }, { allowAnonymousClaims: true });
    for (const claimerName of [undefined, '', '   ', 42]) {
      await expect(claimViaInvite({ token, itemId, userId: null, claimerName }))
        .rejects.toMatchObject({ status: 400, message: 'Name is required for anonymous claims' });
    }
  });

  it('cannot claim an item an authed user already holds', async () => {
    const { bob, token, itemId } = await setup({ title: 'Book' }, { allowAnonymousClaims: true });
    await claimViaInvite({ token, itemId, userId: bob._id });
    await expect(claimViaInvite({ token, itemId, userId: null, claimerName: 'Gran' }))
      .rejects.toMatchObject({ status: 400, message: 'Item already claimed' });
  });

  it('multi: defaults to 1, treats quantity 0 as 1, respects capacity', async () => {
    const { token, itemId } = await setup({ title: 'Socks', quantity: 3 }, { allowAnonymousClaims: true });
    expect(sum(await claimViaInvite({ token, itemId, userId: null, claimerName: 'A' }))).toBe(1);
    expect(sum(await claimViaInvite({ token, itemId, userId: null, claimerName: 'B', quantity: 0 }))).toBe(2);
    expect(sum(await claimViaInvite({ token, itemId, userId: null, claimerName: 'C', quantity: 1 }))).toBe(3);
    await expect(claimViaInvite({ token, itemId, userId: null, claimerName: 'D' }))
      .rejects.toMatchObject({ status: 400, message: 'Only 0 remaining of 3' });
  });
});

describe('invalid tokens', () => {
  it('disabled and regenerated tokens 404', async () => {
    const { owner, bob, list, token, itemId } = await setup({ title: 'Book' });
    const next = await invites.createInviteLink({ userId: owner._id, listId: list._id });
    await expect(claimViaInvite({ token, itemId, userId: bob._id }))
      .rejects.toMatchObject({ status: 404, message: 'Invite link not found or disabled' });
    await invites.disableInviteLink({ userId: owner._id, listId: list._id });
    await expect(claimViaInvite({ token: next.token, itemId, userId: bob._id }))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('concurrency', () => {
  it('two authed users claiming the same single item: exactly one wins', async () => {
    const { bob, carol, list, token, itemId } = await setup({ title: 'Book' });
    const results = await Promise.allSettled([
      claimViaInvite({ token, itemId, userId: bob._id }),
      claimViaInvite({ token, itemId, userId: carol._id })
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const item = (await Wishlist.findById(list._id)).items[0];
    expect(item.status.claimedBy).toBeTruthy();
  });

  it('two multi claims that together exceed capacity: exactly one wins', async () => {
    const { bob, carol, list, token, itemId } = await setup({ title: 'Socks', quantity: 3 });
    const results = await Promise.allSettled([
      claimViaInvite({ token, itemId, userId: bob._id, quantity: 2 }),
      claimViaInvite({ token, itemId, userId: carol._id, quantity: 2 })
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const item = (await Wishlist.findById(list._id)).items[0];
    expect(item.claims.reduce((s, c) => s + c.quantity, 0)).toBeLessThanOrEqual(3);
  });
});
