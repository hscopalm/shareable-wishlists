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

    // Index-isolation sibling test for sharedWith[]. The route filters the
    // array in app code so it's not subject to positional bugs, but locking
    // it down so a refactor to $pull/positional doesn't break it.
    it('should remove only the targeted user when they are not at index 0', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const dave = await createUser({ email: 'dave@test.com', name: 'Dave' });
      const eve = await createUser({ email: 'eve@test.com', name: 'Eve' });
      const wishlist = await createSharedWishlist(alice, [bob, charlie, dave, eve]);
      const agent = await loginAs(alice);

      // Remove the 3rd user (dave, index 2)
      const res = await agent.delete(`/api/share/${wishlist._id}/unshare/${dave._id}`);
      expect(res.status).toBe(200);

      const updated = await Wishlist.findById(wishlist._id);
      const sharedIds = updated.sharedWith.map(id => id.toString());
      expect(sharedIds).toHaveLength(3);
      expect(sharedIds).toContain(bob._id.toString());
      expect(sharedIds).toContain(charlie._id.toString());
      expect(sharedIds).not.toContain(dave._id.toString());
      expect(sharedIds).toContain(eve._id.toString());
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

    // Regression: $elemMatch with $and/$or breaks the positional `$` operator,
    // causing writes to land on item[0] instead of the targeted item. Tests
    // with a single item happened to "work" because index 0 was always right.
    // Both items here are unclaimed; if positional binding is broken, the
    // claim would land on item[0] instead of item[1].
    it('should claim the correct item when it is not at index 0', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'First item', price: 10 },
        { title: 'Second item', price: 20 },
        { title: 'Third item', price: 30 }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();

      const targetItemId = wishlist.items[1]._id;  // Second item, NOT index 0
      const agent = await loginAs(bob);

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${targetItemId}`);
      expect(res.status).toBe(200);

      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.items[0].status?.claimedBy).toBeFalsy();
      expect(updated.items[1].status?.claimedBy?.toString()).toBe(bob._id.toString());
      expect(updated.items[2].status?.claimedBy).toBeFalsy();
    });

    // Same regression for unclaim: only my claim at the targeted index should
    // be cleared, not a different user's claim at index 0.
    it('should unclaim only my claim at the correct index', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'First', status: { claimedBy: charlie._id, claimedAt: new Date() } },
        { title: 'Second', status: { claimedBy: bob._id, claimedAt: new Date() } }
      ]);
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();

      const targetItemId = wishlist.items[1]._id;
      const agent = await loginAs(bob);

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${targetItemId}`);
      expect(res.status).toBe(200);

      const updated = await Wishlist.findById(wishlist._id);
      // Charlie's claim on item[0] must still be intact
      expect(updated.items[0].status?.claimedBy?.toString()).toBe(charlie._id.toString());
      // Bob's claim on item[1] is gone
      expect(updated.items[1].status?.claimedBy).toBeFalsy();
    });
  });

  describe('Multi-quantity claims', () => {
    it('should let two users each claim part of a multi-quantity item', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Hand towels', quantity: 4 }
      ]);
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;

      const bobAgent = await loginAs(bob);
      const bobRes = await bobAgent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: 2 });
      expect(bobRes.status).toBe(200);
      expect(bobRes.body.claims).toHaveLength(1);
      expect(bobRes.body.claims[0].quantity).toBe(2);

      const charlieAgent = await loginAs(charlie);
      const charlieRes = await charlieAgent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: 2 });
      expect(charlieRes.status).toBe(200);
      expect(charlieRes.body.claims).toHaveLength(2);
      const totalClaimed = charlieRes.body.claims.reduce((s, c) => s + c.quantity, 0);
      expect(totalClaimed).toBe(4);
    });

    it('should reject a claim that would exceed the requested quantity', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Hand towels',
          quantity: 4,
          claims: [{ claimedBy: charlie._id, quantity: 3, claimedAt: new Date() }]
        }
      ]);
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;

      const agent = await loginAs(bob);
      const res = await agent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/remaining/);
    });

    it('should let the same user edit their own claim quantity', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Hand towels',
          quantity: 4,
          claims: [
            { claimedBy: charlie._id, quantity: 2, claimedAt: new Date() },
            { claimedBy: bob._id, quantity: 1, claimedAt: new Date() }
          ]
        }
      ]);
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;

      const agent = await loginAs(bob);
      const res = await agent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(200);
      const myClaim = res.body.claims.find(c => c.claimedBy._id === bob._id.toString());
      expect(myClaim.quantity).toBe(2);
      const total = res.body.claims.reduce((s, c) => s + c.quantity, 0);
      expect(total).toBe(4);
    });

    it('should reject if my new claim plus others exceeds quantity', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Hand towels',
          quantity: 4,
          claims: [
            { claimedBy: charlie._id, quantity: 2, claimedAt: new Date() },
            { claimedBy: bob._id, quantity: 1, claimedAt: new Date() }
          ]
        }
      ]);
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;

      const agent = await loginAs(bob);
      const res = await agent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: 4 });

      expect(res.status).toBe(400);
    });

    it('should remove a claim when quantity is 0', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        {
          title: 'Hand towels',
          quantity: 4,
          claims: [{ claimedBy: bob._id, quantity: 2, claimedAt: new Date() }]
        }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;

      const agent = await loginAs(bob);
      const res = await agent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: 0 });

      expect(res.status).toBe(200);
      expect(res.body.claims).toHaveLength(0);
    });

    it('should reject quantity > 1 on a single-mode item', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Single item', price: 50 }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;

      const agent = await loginAs(bob);
      const res = await agent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/single claim/i);
    });

    it('should reject invalid quantity (negative or non-integer)', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Item', quantity: 3 }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const neg = await agent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: -1 });
      expect(neg.status).toBe(400);

      const frac = await agent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .send({ quantity: 1.5 });
      expect(frac.status).toBe(400);
    });

    // Index-isolation for multi-mode. The route uses an aggregation pipeline
    // ($map over items) rather than positional $, so it shouldn't share the
    // single-mode bug. But pin it down: claiming on items[3] must only touch
    // items[3] and not bleed into other items' claims arrays.
    it('should mutate only the targeted item when multi-claiming at non-zero index', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'A' },
        { title: 'B', quantity: 3 },
        { title: 'C', quantity: 4 },
        { title: 'D', quantity: 5 },
        { title: 'E' }
      ]);
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();

      const targetIdx = 3;
      const targetId = wishlist.items[targetIdx]._id;
      const before = await Wishlist.findById(wishlist._id).lean();
      const agent = await loginAs(bob);

      const res = await agent
        .post(`/api/share/claim/${wishlist._id}/${targetId}`)
        .send({ quantity: 2 });
      expect(res.status).toBe(200);
      expect(res.body.claims).toHaveLength(1);
      expect(res.body.claims[0].quantity).toBe(2);

      await expect(wishlist._id).toHaveOnlyMutatedItem(before.items, targetId);
    });

    // P3: race condition for the multi-mode aggregation pipeline. Two users
    // both try to claim 3 of a 4-quantity item simultaneously. Exactly one
    // should succeed; the other should get a 400 capacity error. This is
    // the multi-claim equivalent of the existing single-claim race test in
    // critical-flows.test.js.
    it('should only allow one of two concurrent multi-claims that would exceed capacity', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Towels', quantity: 4 }
      ]);
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;

      const bobAgent = await loginAs(bob);
      const charlieAgent = await loginAs(charlie);

      // Each wants 3 of 4 — together they'd need 6, which is impossible.
      const [bobRes, charlieRes] = await Promise.all([
        bobAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`).send({ quantity: 3 }),
        charlieAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`).send({ quantity: 3 })
      ]);

      const statuses = [bobRes.status, charlieRes.status].sort();
      expect(statuses).toEqual([200, 400]);

      const stored = await Wishlist.findById(wishlist._id);
      const item = stored.items.id(itemId);
      expect(item.claims).toHaveLength(1);
      expect(item.claims[0].quantity).toBe(3);
    });
  });
});
