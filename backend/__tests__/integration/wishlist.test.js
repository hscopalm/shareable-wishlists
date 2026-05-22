const { loginAs, createUnauthenticatedRequest } = require('../helpers/auth');
const { createUser, createTestUsers } = require('../fixtures/users');
const { createWishlist, createWishlistWithItems, createSharedWishlist } = require('../fixtures/wishlists');
const Wishlist = require('../../models/Wishlist');

describe('Wishlist Item Routes', () => {
  describe('POST /api/wishlist - Create item', () => {
    it('should create an item in the user\'s list', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post('/api/wishlist')
        .send({
          list: wishlist._id,
          title: 'New Headphones',
          description: 'Noise cancelling',
          price: 299.99,
          priority: 5,
          link: 'https://example.com/headphones'
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Headphones');
      expect(res.body.price).toBe(299.99);
      expect(res.body.priority).toBe(5);
      expect(res.body._id).toBeDefined();

      // Verify in database
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].title).toBe('New Headphones');
    });

    it('should create item with only required fields', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post('/api/wishlist')
        .send({
          list: wishlist._id,
          title: 'Simple Item'
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Simple Item');
    });

    it('should not allow adding items to someone else\'s list', async () => {
      const { alice, bob } = await createTestUsers();
      const alicesList = await createWishlist(alice);
      const agent = await loginAs(bob);

      const res = await agent
        .post('/api/wishlist')
        .send({
          list: alicesList._id,
          title: 'Hacker Item'
        });

      expect(res.status).toBe(404);

      // Verify no item was added
      const unchanged = await Wishlist.findById(alicesList._id);
      expect(unchanged.items).toHaveLength(0);
    });

    it('should not allow shared user to add items', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob]);
      const agent = await loginAs(bob);

      const res = await agent
        .post('/api/wishlist')
        .send({
          list: wishlist._id,
          title: 'Bob Tries to Add'
        });

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent list', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await agent
        .post('/api/wishlist')
        .send({
          list: fakeId,
          title: 'Test Item'
        });

      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const { request } = createUnauthenticatedRequest();

      const res = await request
        .post('/api/wishlist')
        .send({
          list: wishlist._id,
          title: 'Test Item'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/wishlist/:id - Update item', () => {
    it('should update an item', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Original Title', price: 50 }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({
          title: 'Updated Title',
          price: 75,
          description: 'New description'
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.price).toBe(75);
      expect(res.body.description).toBe('New description');

      // Verify in database
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.items[0].title).toBe('Updated Title');
    });

    it('should not allow updating items in someone else\'s list', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Alice Item' }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ title: 'Bob Hacks' });

      expect(res.status).toBe(404);

      // Verify not updated
      const unchanged = await Wishlist.findById(wishlist._id);
      expect(unchanged.items[0].title).toBe('Alice Item');
    });

    it('should not allow shared user to update items', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Original' }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ title: 'Bob Tries to Update' });

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent item', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      await createWishlist(alice);
      const agent = await loginAs(alice);
      const fakeItemId = '507f1f77bcf86cd799439011';

      const res = await agent
        .put(`/api/wishlist/${fakeItemId}`)
        .send({ title: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should accept a quantity field on create', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post('/api/wishlist')
        .send({ list: wishlist._id, title: 'Hand towels', quantity: 4 });

      expect(res.status).toBe(201);
      expect(res.body.quantity).toBe(4);
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.items[0].quantity).toBe(4);
    });

    it('should reject invalid quantity values', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post('/api/wishlist')
        .send({ list: wishlist._id, title: 'Bad', quantity: -1 });

      expect(res.status).toBe(400);
    });

    it('should migrate status to claims when quantity goes from undefined to >1', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Item', status: { claimedBy: bob._id, claimedAt: new Date() } }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.quantity).toBe(3);
      expect(res.body.claims).toHaveLength(1);
      expect(res.body.claims[0].quantity).toBe(1);

      const stored = await Wishlist.findById(wishlist._id);
      const item = stored.items.id(itemId);
      expect(item.claims).toHaveLength(1);
      expect(item.claims[0].claimedBy.toString()).toBe(bob._id.toString());
      expect(item.status?.claimedBy).toBeFalsy();
    });

    it('should warn when reducing quantity below total claimed', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Towels',
          quantity: 4,
          claims: [
            { claimedBy: bob._id, quantity: 2, claimedAt: new Date() },
            { claimedBy: charlie._id, quantity: 1, claimedAt: new Date() }
          ]
        }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.warning).toMatch(/claimed total/i);
    });

    it('should collapse a single claim back to status when going from multi to single', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Towels',
          quantity: 3,
          claims: [{ claimedBy: bob._id, quantity: 1, claimedAt: new Date() }]
        }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ quantity: 1 });

      expect(res.status).toBe(200);
      const stored = await Wishlist.findById(wishlist._id);
      const item = stored.items.id(itemId);
      expect(item.quantity).toBeFalsy();
      expect(item.claims).toHaveLength(0);
      expect(item.status?.claimedBy?.toString()).toBe(bob._id.toString());
    });

    // Index-isolation sibling test for PUT. The route uses items.set(idx, ...)
    // rather than positional $, so it shouldn't have the same positional bug,
    // but pinning it down catches accidental regressions if anyone refactors
    // back to $set/$inc/etc.
    it('should update only the targeted item when it is not at index 0', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, 5);
      const targetIdx = 3;
      const targetId = wishlist.items[targetIdx]._id;
      const before = await Wishlist.findById(wishlist._id).lean();
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${targetId}`)
        .send({ title: 'Renamed item', price: 999 });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Renamed item');
      await expect(wishlist._id).toHaveOnlyMutatedItem(before.items, targetId);
    });

    // P2: claim-preservation on non-quantity edits. Existing tests update an
    // item that has no claim; this verifies an unrelated edit doesn't blow
    // away active claims on a multi-quantity item.
    it('should preserve claims when editing a non-quantity field on a multi-mode item', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Towels',
          quantity: 4,
          claims: [{ claimedBy: bob._id, quantity: 2, claimedAt: new Date() }]
        }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ title: 'Hand towels', description: 'fluffy' });

      expect(res.status).toBe(200);
      const stored = await Wishlist.findById(wishlist._id);
      const item = stored.items.id(itemId);
      expect(item.title).toBe('Hand towels');
      expect(item.quantity).toBe(4);
      expect(item.claims).toHaveLength(1);
      expect(item.claims[0].claimedBy.toString()).toBe(bob._id.toString());
      expect(item.claims[0].quantity).toBe(2);
    });

    // P2: bumping quantity when claims already exist (already multi). No
    // warning, claims preserved, quantity changed.
    it('should bump quantity on an existing multi-mode item without warning', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Towels',
          quantity: 2,
          claims: [{ claimedBy: bob._id, quantity: 1, claimedAt: new Date() }]
        }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.warning).toBeFalsy();
      expect(res.body.quantity).toBe(5);
      expect(res.body.claims).toHaveLength(1);
    });

    // P2: reducing quantity from 5 to 3 when 4 claimed. Warning returned;
    // claims kept as-is (allowed-with-warning behavior).
    it('should warn but keep claims when reducing quantity below claimed sum (multi to smaller multi)', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Towels',
          quantity: 5,
          claims: [
            { claimedBy: bob._id, quantity: 2, claimedAt: new Date() },
            { claimedBy: charlie._id, quantity: 2, claimedAt: new Date() }
          ]
        }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.warning).toMatch(/claimed total/i);
      const stored = await Wishlist.findById(wishlist._id);
      const item = stored.items.id(itemId);
      expect(item.quantity).toBe(3);
      expect(item.claims).toHaveLength(2);
    });

    // P2: editing an item that doesn't exist returns 404, not 500. Guard
    // against a TypeError on the spread-merge path.
    it('should return 404 (not 500) when the item id is unknown', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      await createWishlistWithItems(alice, 3);
      const agent = await loginAs(alice);
      const ghostId = '507f1f77bcf86cd799439011';

      const res = await agent
        .put(`/api/wishlist/${ghostId}`)
        .send({ title: 'Nope', quantity: 4 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/wishlist/:id - Delete item', () => {
    it('should delete an item', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Item 1' },
        { title: 'Item 2' }
      ]);
      const itemToDelete = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent.delete(`/api/wishlist/${itemToDelete}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Item deleted');

      // Verify in database
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].title).toBe('Item 2');
    });

    it('should not allow deleting items from someone else\'s list', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Alice Item' }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent.delete(`/api/wishlist/${itemId}`);

      expect(res.status).toBe(404);

      // Verify not deleted
      const unchanged = await Wishlist.findById(wishlist._id);
      expect(unchanged.items).toHaveLength(1);
    });

    it('should not allow shared user to delete items', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item' }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent.delete(`/api/wishlist/${itemId}`);

      expect(res.status).toBe(404);

      // Verify not deleted
      const unchanged = await Wishlist.findById(wishlist._id);
      expect(unchanged.items).toHaveLength(1);
    });

    it('should return 404 for non-existent item', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      await createWishlist(alice);
      const agent = await loginAs(alice);
      const fakeItemId = '507f1f77bcf86cd799439011';

      const res = await agent.delete(`/api/wishlist/${fakeItemId}`);

      expect(res.status).toBe(404);
    });

    // Index-isolation regression: deletes via array filter, not positional,
    // but worth pinning down so future refactors don't regress.
    it('should delete only the targeted item when it is not at index 0', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, 5);
      const targetIdx = 3;
      const targetTitle = wishlist.items[targetIdx].title;
      const targetId = wishlist.items[targetIdx]._id;
      const agent = await loginAs(alice);

      const res = await agent.delete(`/api/wishlist/${targetId}`);
      expect(res.status).toBe(200);

      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.items).toHaveLength(4);
      expect(updated.items.find(i => i._id.toString() === targetId.toString())).toBeUndefined();
      expect(updated.items.find(i => i.title === targetTitle)).toBeUndefined();
    });
  });
});
