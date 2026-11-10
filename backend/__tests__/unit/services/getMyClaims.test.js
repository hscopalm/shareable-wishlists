const { createTestUsers } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');
const Wishlist = require('../../../models/Wishlist');
const { claimItem, getMyClaims } = require('../../../services/claims');

describe('getMyClaims', () => {
  async function setup() {
    const { alice, bob, charlie } = await createTestUsers();
    const list = await createWishlist(alice, {
      name: 'Alice Birthday',
      sharedWith: [bob._id, charlie._id],
      items: [
        { title: 'Single' },
        { title: 'Socks', quantity: 4 },
        { title: 'Fund', type: 'cash', paymentLinks: { venmo: 'alice' } },
        { title: 'Untouched' }
      ]
    });
    return { alice, bob, charlie, list, itemIds: list.items.map(i => i._id) };
  }

  it('returns single, multi (with my quantity) and cash claims grouped by list with owner', async () => {
    const { alice, bob, list, itemIds } = await setup();
    for (const [i, quantity] of [[0, 1], [1, 3], [2, 1]]) {
      await claimItem({ userId: bob._id, listId: list._id, itemId: itemIds[i], quantity });
    }

    const result = await getMyClaims({ userId: bob._id });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ listName: 'Alice Birthday', owner: { name: alice.name } });
    expect(result[0].items.map(i => [i.title, i.type, i.myQuantity])).toEqual([
      ['Single', 'gift', 1],
      ['Socks', 'gift', 3],
      ['Fund', 'cash', 1]
    ]);
  });

  it('only includes my claims, not other people\'s', async () => {
    const { bob, charlie, list, itemIds } = await setup();
    await claimItem({ userId: charlie._id, listId: list._id, itemId: itemIds[0], quantity: 1 });
    await claimItem({ userId: bob._id, listId: list._id, itemId: itemIds[1], quantity: 1 });
    const result = await getMyClaims({ userId: bob._id });
    expect(result[0].items.map(i => i.title)).toEqual(['Socks']);
  });

  it('excludes lists that are no longer shared with me, and returns [] with no claims', async () => {
    const { bob, list, itemIds } = await setup();
    expect(await getMyClaims({ userId: bob._id })).toEqual([]);
    await claimItem({ userId: bob._id, listId: list._id, itemId: itemIds[0], quantity: 1 });
    await Wishlist.updateOne({ _id: list._id }, { $pull: { sharedWith: bob._id } });
    expect(await getMyClaims({ userId: bob._id })).toEqual([]);
  });
});
