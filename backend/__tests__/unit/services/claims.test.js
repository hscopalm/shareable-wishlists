const Wishlist = require('../../../models/Wishlist');
const { createUser } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');
const { claimItem } = require('../../../services/claims');
const { unshareList } = require('../../../services/sharing');
const { NotFoundError, ValidationError, ConflictError } = require('../../../services/errors');

async function setup(item) {
  const owner = await createUser();
  const bob = await createUser();
  const carol = await createUser();
  const list = await createWishlist(owner, { sharedWith: [bob._id, carol._id], items: [item] });
  return { owner, bob, carol, list, itemId: list.items[0]._id.toString(), listId: list._id.toString() };
}

async function reload(listId, itemId) {
  const l = await Wishlist.findById(listId);
  return l.items.id(itemId);
}

describe('claimItem authorization', () => {
  it('rejects users the list is not shared with (owner included) as NotFound', async () => {
    const { owner, listId, itemId } = await setup({ title: 'Book' });
    const stranger = await createUser();
    await expect(claimItem({ userId: stranger._id, listId, itemId }))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(claimItem({ userId: owner._id, listId, itemId }))
      .rejects.toMatchObject({ status: 404, message: 'List not found or not shared with you' });
  });

  it('rejects an unknown item', async () => {
    const { bob, listId } = await setup({ title: 'Book' });
    await expect(claimItem({ userId: bob._id, listId, itemId: '507f1f77bcf86cd799439011' }))
      .rejects.toMatchObject({ status: 404, message: 'Item not found' });
  });

  it('rejects negative and fractional quantities', async () => {
    const { bob, listId, itemId } = await setup({ title: 'Book' });
    for (const quantity of [-1, 1.5, 'abc']) {
      await expect(claimItem({ userId: bob._id, listId, itemId, quantity }))
        .rejects.toBeInstanceOf(ValidationError);
    }
  });
});

describe('claimItem single mode', () => {
  it('toggles claim and unclaim with no quantity', async () => {
    const { bob, listId, itemId } = await setup({ title: 'Book' });
    const claimed = await claimItem({ userId: bob._id, listId, itemId });
    expect(claimed.claims).toHaveLength(1);
    const unclaimed = await claimItem({ userId: bob._id, listId, itemId });
    expect(unclaimed.claims).toHaveLength(0);
  });

  it('throws a conflict (HTTP 400) when someone else holds it, and leaves the holder intact', async () => {
    const { bob, carol, listId, itemId } = await setup({ title: 'Book' });
    await claimItem({ userId: bob._id, listId, itemId });
    const err = await claimItem({ userId: carol._id, listId, itemId }).catch(e => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Item already claimed by someone else');
    const item = await reload(listId, itemId);
    expect(item.status.claimedBy.toString()).toBe(bob._id.toString());
  });

  it('exactly one of two simultaneous claims wins', async () => {
    const { bob, carol, listId, itemId } = await setup({ title: 'Book' });
    const results = await Promise.allSettled([
      claimItem({ userId: bob._id, listId, itemId }),
      claimItem({ userId: carol._id, listId, itemId })
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('unclaiming an item someone else holds is a no-op that does not steal it', async () => {
    const { bob, carol, listId, itemId } = await setup({ title: 'Book' });
    await claimItem({ userId: bob._id, listId, itemId });
    await claimItem({ userId: carol._id, listId, itemId, quantity: 0 });
    const item = await reload(listId, itemId);
    expect(item.status.claimedBy.toString()).toBe(bob._id.toString());
  });

  it('explicit quantity 1 is idempotent and never toggles off (#43)', async () => {
    const { bob, listId, itemId } = await setup({ title: 'Book' });
    await claimItem({ userId: bob._id, listId, itemId, quantity: 1 });
    const again = await claimItem({ userId: bob._id, listId, itemId, quantity: 1 });
    expect(again.claims).toHaveLength(1);
    const results = await Promise.allSettled([
      claimItem({ userId: bob._id, listId, itemId, quantity: 1 }),
      claimItem({ userId: bob._id, listId, itemId, quantity: 1 })
    ]);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    expect((await reload(listId, itemId)).status.claimedBy.toString()).toBe(bob._id.toString());
    // Explicit unclaim is idempotent too
    await claimItem({ userId: bob._id, listId, itemId, quantity: 0 });
    expect((await claimItem({ userId: bob._id, listId, itemId, quantity: 0 })).claims).toHaveLength(0);
  });

  it('rejects quantity > 1', async () => {
    const { bob, listId, itemId } = await setup({ title: 'Book' });
    await expect(claimItem({ userId: bob._id, listId, itemId, quantity: 2 }))
      .rejects.toMatchObject({ status: 400, message: 'This item only allows a single claim' });
  });
});

describe('claimItem multi-quantity capacity', () => {
  it('allows filling exactly to capacity and rejects one more', async () => {
    const { bob, carol, listId, itemId } = await setup({ title: 'Socks', quantity: 3 });
    await claimItem({ userId: bob._id, listId, itemId, quantity: 2 });
    const full = await claimItem({ userId: carol._id, listId, itemId, quantity: 1 });
    expect(full.claims.reduce((s, c) => s + c.quantity, 0)).toBe(3);

    const err = await claimItem({ userId: carol._id, listId, itemId, quantity: 2 }).catch(e => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Only 1 remaining of 3');
  });

  it('rejects over-capacity on the first claim', async () => {
    const { bob, listId, itemId } = await setup({ title: 'Socks', quantity: 3 });
    await expect(claimItem({ userId: bob._id, listId, itemId, quantity: 4 }))
      .rejects.toMatchObject({ status: 400, message: 'Only 3 remaining of 3' });
  });

  it('lets a user reduce their own claim and frees the capacity', async () => {
    const { bob, carol, listId, itemId } = await setup({ title: 'Socks', quantity: 3 });
    await claimItem({ userId: bob._id, listId, itemId, quantity: 3 });
    await claimItem({ userId: bob._id, listId, itemId, quantity: 1 });
    const out = await claimItem({ userId: carol._id, listId, itemId, quantity: 2 });
    expect(out.claims.map(c => c.quantity).sort()).toEqual([1, 2]);
  });

  it('quantity 0 removes only my claim; missing quantity claims one', async () => {
    const { bob, carol, listId, itemId } = await setup({ title: 'Socks', quantity: 3 });
    await claimItem({ userId: bob._id, listId, itemId, quantity: 2 });
    const carolDefault = await claimItem({ userId: carol._id, listId, itemId });
    expect(carolDefault.claims).toHaveLength(2);
    const after = await claimItem({ userId: bob._id, listId, itemId, quantity: 0 });
    expect(after.claims).toHaveLength(1);
    expect(after.claims[0].quantity).toBe(1);
  });

  it('concurrent claims never exceed capacity', async () => {
    const { bob, carol, listId, itemId } = await setup({ title: 'Socks', quantity: 3 });
    const results = await Promise.allSettled([
      claimItem({ userId: bob._id, listId, itemId, quantity: 2 }),
      claimItem({ userId: carol._id, listId, itemId, quantity: 2 })
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const item = await reload(listId, itemId);
    expect(item.claims.reduce((s, c) => s + c.quantity, 0)).toBeLessThanOrEqual(3);
  });
});

describe('claimItem cash items', () => {
  const cash = { type: 'cash', title: 'Cash gift', paymentLinks: { venmo: 'alice' } };

  it('toggles contribution with no quantity', async () => {
    const { bob, listId, itemId } = await setup(cash);
    expect((await claimItem({ userId: bob._id, listId, itemId })).claims).toHaveLength(1);
    expect((await claimItem({ userId: bob._id, listId, itemId })).claims).toHaveLength(0);
  });

  it('is idempotent for repeated explicit claims and quantity 0 unclaims', async () => {
    const { bob, carol, listId, itemId } = await setup(cash);
    await claimItem({ userId: bob._id, listId, itemId, quantity: 5 });
    await claimItem({ userId: bob._id, listId, itemId, quantity: 5 });
    const both = await claimItem({ userId: carol._id, listId, itemId, quantity: 1 });
    expect(both.claims).toHaveLength(2);
    expect(both.claims.every(c => c.quantity === 1)).toBe(true);
    const after = await claimItem({ userId: bob._id, listId, itemId, quantity: 0 });
    expect(after.claims).toHaveLength(1);
  });
});

describe('unsharing and existing claims (current behaviour)', () => {
  it('removes access but leaves the removed user\'s claim on the item', async () => {
    const { owner, bob, listId, itemId } = await setup({ title: 'Book' });
    await claimItem({ userId: bob._id, listId, itemId });
    await unshareList({ userId: owner._id, listId, targetUserId: bob._id.toString() });

    await expect(claimItem({ userId: bob._id, listId, itemId, quantity: 0 }))
      .rejects.toBeInstanceOf(NotFoundError);
    const item = await reload(listId, itemId);
    expect(item.status.claimedBy.toString()).toBe(bob._id.toString());
  });
});
