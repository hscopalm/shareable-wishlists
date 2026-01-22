const { loginAs } = require('../helpers/auth');
const { createUser, createTestUsers } = require('../fixtures/users');
const { createWishlist, createWishlistWithItems, createSharedWishlist } = require('../fixtures/wishlists');
const Wishlist = require('../../models/Wishlist');
const User = require('../../models/User');

describe('Sharing Routes', () => {
  describe('POST /api/share/:listId - Share a list', () => {
    it('should share a list with an existing user', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post(`/api/share/${wishlist._id}`)
        .send({ email: bob.email });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(bob.email);
      expect(res.body.isPending).toBe(false);

      // Verify the wishlist was updated
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.sharedWith.map(id => id.toString())).toContain(bob._id.toString());
    });

    it('should create a pending user when sharing with unknown email', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);
      const newEmail = 'newuser@example.com';

      const res = await agent
        .post(`/api/share/${wishlist._id}`)
        .send({ email: newEmail });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(newEmail);
      expect(res.body.isPending).toBe(true);

      // Verify pending user was created
      const pendingUser = await User.findOne({ email: newEmail });
      expect(pendingUser).toBeTruthy();
      expect(pendingUser.isPending).toBe(true);

      // Verify wishlist was shared with pending user
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.sharedWith.map(id => id.toString())).toContain(pendingUser._id.toString());
    });

    it('should prevent sharing with yourself', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post(`/api/share/${wishlist._id}`)
        .send({ email: alice.email });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cannot share with yourself');
    });

    it('should prevent duplicate shares', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob]);
      const agent = await loginAs(alice);

      const res = await agent
        .post(`/api/share/${wishlist._id}`)
        .send({ email: bob.email });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('List already shared with this user');
    });

    it('should return 404 for non-existent list', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await agent
        .post(`/api/share/${fakeId}`)
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(404);
    });

    it('should return 404 when trying to share someone else\'s list', async () => {
      const { alice, bob } = await createTestUsers();
      const alicesList = await createWishlist(alice);
      const agent = await loginAs(bob); // Bob tries to share Alice's list

      const res = await agent
        .post(`/api/share/${alicesList._id}`)
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const { createUnauthenticatedRequest } = require('../helpers/auth');
      const { request } = createUnauthenticatedRequest();

      const res = await request
        .post(`/api/share/${wishlist._id}`)
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/share/:listId/shared-with - Get shared users', () => {
    it('should return list of shared users', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob, charlie]);
      const agent = await loginAs(alice);

      const res = await agent.get(`/api/share/${wishlist._id}/shared-with`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const emails = res.body.map(u => u.email);
      expect(emails).toContain(bob.email);
      expect(emails).toContain(charlie.email);
    });

    it('should return empty array for unshared list', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent.get(`/api/share/${wishlist._id}/shared-with`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should only allow owner to view shared users', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob]);
      const agent = await loginAs(bob); // Bob is shared user, not owner

      const res = await agent.get(`/api/share/${wishlist._id}/shared-with`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/share/:listId/unshare/:userId - Unshare a list', () => {
    it('should remove a user from shared list', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob, charlie]);
      const agent = await loginAs(alice);

      const res = await agent.delete(`/api/share/${wishlist._id}/unshare/${bob._id}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Share removed successfully');

      // Verify Bob was removed but Charlie remains
      const updated = await Wishlist.findById(wishlist._id);
      const sharedIds = updated.sharedWith.map(id => id.toString());
      expect(sharedIds).not.toContain(bob._id.toString());
      expect(sharedIds).toContain(charlie._id.toString());
    });

    it('should only allow owner to unshare', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob, charlie]);
      const agent = await loginAs(bob); // Bob tries to unshare Charlie

      const res = await agent.delete(`/api/share/${wishlist._id}/unshare/${charlie._id}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/share/shared-with-me - Get lists shared with current user', () => {
    it('should return lists shared with user', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const list1 = await createSharedWishlist(alice, [bob], { name: 'Alice List' });
      const list2 = await createSharedWishlist(charlie, [bob], { name: 'Charlie List' });
      await createWishlist(alice, { name: 'Not Shared' }); // Not shared with Bob

      const agent = await loginAs(bob);
      const res = await agent.get('/api/share/shared-with-me');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const names = res.body.map(l => l.name);
      expect(names).toContain('Alice List');
      expect(names).toContain('Charlie List');
    });

    it('should include owner info in response', async () => {
      const { alice, bob } = await createTestUsers();
      await createSharedWishlist(alice, [bob], { name: 'Test List' });
      const agent = await loginAs(bob);

      const res = await agent.get('/api/share/shared-with-me');

      expect(res.status).toBe(200);
      expect(res.body[0].owner).toBeDefined();
      expect(res.body[0].owner.email).toBe(alice.email);
      expect(res.body[0].owner.name).toBe(alice.name);
    });

    it('should return empty array if no lists shared', async () => {
      const bob = await createUser({ email: 'bob@test.com', name: 'Bob' });
      const agent = await loginAs(bob);

      const res = await agent.get('/api/share/shared-with-me');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /api/share/claim/:listId/:itemId - Claim/unclaim items', () => {
    it('should allow shared user to claim an item', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 50 }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();

      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);

      expect(res.status).toBe(200);
      expect(res.body.status.claimedBy).toBeDefined();

      // Verify in database
      const updated = await Wishlist.findById(wishlist._id);
      const item = updated.items.id(itemId);
      expect(item.status.claimedBy.toString()).toBe(bob._id.toString());
      expect(item.status.claimedAt).toBeDefined();
    });

    it('should allow user to unclaim their own claim', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 50, status: { claimedBy: bob._id, claimedAt: new Date() } }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();

      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);

      expect(res.status).toBe(200);

      // Verify claim was removed
      const updated = await Wishlist.findById(wishlist._id);
      const item = updated.items.id(itemId);
      expect(item.status.claimedBy).toBeUndefined();
    });

    it('should prevent claiming item already claimed by someone else', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 50, status: { claimedBy: charlie._id, claimedAt: new Date() } }
      ]);
      wishlist.sharedWith.push(bob._id);
      wishlist.sharedWith.push(charlie._id);
      await wishlist.save();

      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob); // Bob tries to claim Charlie's item

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Item already claimed by someone else');
    });

    it('should not allow non-shared user to claim', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 50 }
      ]);
      // Note: Bob is NOT in sharedWith

      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('List not found or not shared with you');
    });

    it('should not allow owner to claim their own items', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 50 }
      ]);

      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice); // Owner tries to claim

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);

      // Owner is not in sharedWith, so should get 404
      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent item', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlist(alice);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();

      const fakeItemId = '507f1f77bcf86cd799439011';
      const agent = await loginAs(bob);

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${fakeItemId}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Item not found');
    });
  });
});
