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
});
