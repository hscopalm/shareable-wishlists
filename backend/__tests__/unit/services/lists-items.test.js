const { createUser } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');
const lists = require('../../../services/lists');
const items = require('../../../services/items');
const { claimItem } = require('../../../services/claims');
const { NotFoundError, ValidationError } = require('../../../services/errors');

describe('list authorization', () => {
  it('shared users can read but not update or delete; strangers cannot read', async () => {
    const owner = await createUser();
    const bob = await createUser();
    const stranger = await createUser();
    const list = await createWishlist(owner, { sharedWith: [bob._id] });
    const base = { listId: list._id };

    await expect(lists.getList({ userId: bob._id, ...base })).resolves.toMatchObject({ isShared: true });
    await expect(lists.getList({ userId: owner._id, ...base })).resolves.toMatchObject({ isShared: false });
    await expect(lists.getList({ userId: stranger._id, ...base })).rejects.toBeInstanceOf(NotFoundError);
    await expect(lists.updateList({ userId: bob._id, ...base, name: 'Hacked' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(lists.deleteList({ userId: bob._id, ...base })).rejects.toBeInstanceOf(NotFoundError);
    await expect(lists.deleteList({ userId: owner._id, ...base })).resolves.toEqual({ message: 'List deleted successfully' });
  });
});

describe('item authorization', () => {
  it('only the owner can create, update or delete items', async () => {
    const owner = await createUser();
    const bob = await createUser();
    const list = await createWishlist(owner, { sharedWith: [bob._id], items: [{ title: 'Book' }] });
    const itemId = list.items[0]._id.toString();

    await expect(items.createItem({ userId: bob._id, listId: list._id, data: { title: 'X' } }))
      .rejects.toMatchObject({ status: 404, message: 'List not found' });
    await expect(items.updateItem({ userId: bob._id, itemId, data: { title: 'X' } }))
      .rejects.toMatchObject({ status: 404, message: 'Item not found' });
    await expect(items.deleteItem({ userId: bob._id, itemId }))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(items.deleteItem({ userId: owner._id, itemId })).resolves.toEqual({ message: 'Item deleted' });
  });
});

describe('item validation and quantity transitions', () => {
  it('rejects bad quantities and cash items without payment handles', async () => {
    const owner = await createUser();
    const list = await createWishlist(owner);
    await expect(items.createItem({ userId: owner._id, listId: list._id, data: { title: 'A', quantity: 0 } }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(items.createItem({ userId: owner._id, listId: list._id, data: { title: 'A', type: 'cash' } }))
      .rejects.toMatchObject({ message: 'At least one payment handle is required' });
  });

  it('refuses to change an item type', async () => {
    const owner = await createUser();
    const list = await createWishlist(owner, { items: [{ title: 'Book' }] });
    await expect(items.updateItem({ userId: owner._id, itemId: list.items[0]._id.toString(), data: { type: 'cash' } }))
      .rejects.toMatchObject({ status: 400, message: 'Item type cannot be changed' });
  });

  it('migrates a single claim into claims[] when quantity goes above 1, and warns when shrinking below claimed', async () => {
    const owner = await createUser();
    const bob = await createUser();
    const carol = await createUser();
    const list = await createWishlist(owner, { sharedWith: [bob._id, carol._id], items: [{ title: 'Socks' }] });
    const itemId = list.items[0]._id.toString();
    await claimItem({ userId: bob._id, listId: list._id, itemId });

    const multi = await items.updateItem({ userId: owner._id, itemId, data: { title: 'Socks', quantity: 3 } });
    expect(multi.claims).toHaveLength(1);
    expect(multi.claims[0].quantity).toBe(1);

    await claimItem({ userId: carol._id, listId: list._id, itemId, quantity: 2 });
    const shrunk = await items.updateItem({ userId: owner._id, itemId, data: { quantity: 2 } });
    expect(shrunk.warning).toMatch(/below the current claimed total/);

    const single = await items.updateItem({ userId: owner._id, itemId, data: { quantity: null } });
    expect(single.warning).toMatch(/2 partial claims remain/);
  });
});
