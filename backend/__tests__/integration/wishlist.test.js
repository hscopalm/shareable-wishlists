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
      // Owner response never carries claim data; check storage instead.
      expect(res.body.claims).toEqual([]);

      const stored = await Wishlist.findById(wishlist._id);
      const item = stored.items.id(itemId);
      expect(item.claims).toHaveLength(1);
      expect(item.claims[0].claimedBy.toString()).toBe(bob._id.toString());
      expect(item.status?.claimedBy).toBeFalsy();
    });

    it('should allow reducing quantity below total claimed without revealing claims', async () => {
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
      expect(res.body.quantity).toBe(2);
      // The claim-count warning would tell the owner items were claimed.
      expect(res.body.warning).toBeUndefined();
      expect(res.body.claims).toEqual([]);
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
  });

  // Regression coverage for issue #20: an update must either persist or fail.
  // Every check below re-reads from the DB instead of trusting the response.
  describe('Updates persist or fail loudly (#20)', () => {
    it('should not report success when the stored item has no _id', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      // Bypass Mongoose so the embedded item is stored without an _id, as
      // happened after a raw mongosh import.
      const { insertedId } = await Wishlist.collection.insertOne({
        name: 'Imported',
        user: alice._id,
        sharedWith: [],
        createdAt: new Date(),
        items: [{ title: 'Imported Item', price: 10 }]
      });
      const agent = await loginAs(alice);

      const listRes = await agent.get(`/api/lists/${insertedId}`);
      expect(listRes.status).toBe(200);
      const handedOutId = listRes.body.items[0]._id;
      expect(handedOutId).toBeDefined();

      const putRes = await agent
        .put(`/api/wishlist/${handedOutId}`)
        .send({ title: 'Edited' });
      expect(putRes.status).toBeGreaterThanOrEqual(400);

      const delRes = await agent.delete(`/api/wishlist/${handedOutId}`);
      expect(delRes.status).toBeGreaterThanOrEqual(400);

      const raw = await Wishlist.collection.findOne({ _id: insertedId });
      expect(raw.items).toHaveLength(1);
      expect(raw.items[0].title).toBe('Imported Item');
    });

    it('should persist edits to a single-claim item', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Other', price: 1 },
        { title: 'Lamp', price: 40, priority: 2, notes: 'old' }
      ]);
      const itemId = wishlist.items[1]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ title: 'Desk Lamp', price: 55, priority: 4, notes: 'new', link: 'https://example.com/lamp' });
      expect(res.status).toBe(200);

      const stored = (await Wishlist.findById(wishlist._id)).items.id(itemId);
      expect(stored.title).toBe('Desk Lamp');
      expect(stored.price).toBe(55);
      expect(stored.priority).toBe(4);
      expect(stored.notes).toBe('new');
      expect(stored.link).toBe('https://example.com/lamp');
    });

    it('should persist edits to a multi-quantity item without touching its claims', async () => {
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
        .send({ title: 'Bath Towels', quantity: 6, price: 12 });
      expect(res.status).toBe(200);

      const stored = (await Wishlist.findById(wishlist._id)).items.id(itemId);
      expect(stored.title).toBe('Bath Towels');
      expect(stored.quantity).toBe(6);
      expect(stored.price).toBe(12);
      expect(stored.claims).toHaveLength(1);
      expect(stored.claims[0].claimedBy.toString()).toBe(bob._id.toString());
      expect(stored.claims[0].quantity).toBe(2);
    });

    it('should persist edits to a cash item', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, [
        { type: 'cash', title: 'Fund', paymentLinks: { venmo: 'alice' } }
      ]);
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({ title: 'Honeymoon Fund', notes: 'thanks', paymentLinks: { venmo: 'alice2', paypal: 'alicepp' } });
      expect(res.status).toBe(200);

      const stored = (await Wishlist.findById(wishlist._id)).items.id(itemId);
      expect(stored.title).toBe('Honeymoon Fund');
      expect(stored.notes).toBe('thanks');
      expect(stored.paymentLinks.venmo).toBe('alice2');
      expect(stored.paymentLinks.paypal).toBe('alicepp');
    });

    it('should persist a delete and leave sibling items intact', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Keep 1' },
        { title: 'Remove' },
        { title: 'Keep 2' }
      ]);
      const [keep1, remove, keep2] = wishlist.items.map(i => i._id.toString());
      const agent = await loginAs(alice);

      const res = await agent.delete(`/api/wishlist/${remove}`);
      expect(res.status).toBe(200);

      const stored = await Wishlist.findById(wishlist._id);
      expect(stored.items.map(i => i._id.toString())).toEqual([keep1, keep2]);
    });

    it('should not let the request body overwrite server-controlled item fields', async () => {
      const { alice, bob } = await createTestUsers();
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Item', createdAt, status: { claimedBy: bob._id, claimedAt: new Date() } }
      ]);
      const itemId = wishlist.items[0]._id.toString();
      const agent = await loginAs(alice);
      const forgedId = '507f1f77bcf86cd799439011';

      const res = await agent
        .put(`/api/wishlist/${itemId}`)
        .send({
          title: 'Renamed',
          _id: forgedId,
          createdAt: '2030-01-01T00:00:00Z',
          status: {},
          claims: [{ claimedBy: alice._id, quantity: 1 }]
        });
      expect(res.status).toBe(200);

      const stored = await Wishlist.findById(wishlist._id);
      expect(stored.items).toHaveLength(1);
      const item = stored.items[0];
      expect(item._id.toString()).toBe(itemId);
      expect(item.title).toBe('Renamed');
      expect(item.createdAt.toISOString()).toBe(createdAt.toISOString());
      expect(item.status.claimedBy.toString()).toBe(bob._id.toString());
      expect(item.claims).toHaveLength(0);
    });

    it('should not let a create request forge claims or ids', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);
      const forgedId = '507f1f77bcf86cd799439011';

      const res = await agent
        .post('/api/wishlist')
        .send({
          list: wishlist._id,
          title: 'New',
          _id: forgedId,
          status: { claimedBy: bob._id },
          claims: [{ claimedBy: bob._id, quantity: 1 }]
        });
      expect(res.status).toBe(201);

      const item = (await Wishlist.findById(wishlist._id)).items[0];
      expect(item._id.toString()).not.toBe(forgedId);
      expect(item.status?.claimedBy).toBeFalsy();
      expect(item.claims).toHaveLength(0);
    });
  });
});
