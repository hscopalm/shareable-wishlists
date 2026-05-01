const supertest = require('supertest');
const { loginAs, createUnauthenticatedRequest } = require('../helpers/auth');
const { createTestUsers } = require('../fixtures/users');
const { createWishlistWithItems } = require('../fixtures/wishlists');
const Wishlist = require('../../models/Wishlist');

describe('Invite Link Sharing', () => {
  let alice, bob, charlie;

  beforeEach(async () => {
    const users = await createTestUsers();
    alice = users.alice;
    bob = users.bob;
    charlie = users.charlie;
  });

  describe('Token Generation', () => {
    it('should generate an invite link for a list', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.token.length).toBe(64);
      expect(res.body.link).toContain(res.body.token);
    });

    it('should regenerate a different token', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const agent = await loginAs(alice);

      const res1 = await agent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      const res2 = await agent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      expect(res1.body.token).not.toBe(res2.body.token);
    });

    it('should only allow the owner to generate tokens', async () => {
      const wishlist = await createWishlistWithItems(alice, [], {
        sharedWith: [bob._id]
      });
      const agent = await loginAs(bob);

      await agent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(404);
    });

    it('should return invite link status', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const agent = await loginAs(alice);

      // Initially no link
      const res1 = await agent
        .get(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);
      expect(res1.body.enabled).toBe(false);
      expect(res1.body.token).toBeNull();

      // After generating
      await agent.post(`/api/share/${wishlist._id}/invite-link`);
      const res2 = await agent
        .get(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);
      expect(res2.body.enabled).toBe(true);
      expect(res2.body.token).toBeDefined();
    });
  });

  describe('Disable Invite Link', () => {
    it('should disable an invite link', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const agent = await loginAs(alice);

      const genRes = await agent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      await agent
        .delete(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      // Public access should fail
      const { request } = createUnauthenticatedRequest();
      await request
        .get(`/api/public/invite/${genRes.body.token}`)
        .expect(404);
    });
  });

  describe('Public Access', () => {
    it('should return list data for a valid token', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const agent = await loginAs(alice);

      const genRes = await agent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      const { request } = createUnauthenticatedRequest();
      const res = await request
        .get(`/api/public/invite/${genRes.body.token}`)
        .expect(200);

      expect(res.body.list.name).toBe(wishlist.name);
      expect(res.body.list.owner.name).toBe(alice.name);
      // Should not expose owner email
      expect(res.body.list.owner.email).toBeUndefined();
      expect(res.body.items.length).toBe(2);
    });

    it('should return 404 for invalid token', async () => {
      const { request } = createUnauthenticatedRequest();
      await request
        .get('/api/public/invite/invalidtoken123')
        .expect(404);
    });

    it('should expose claimer name and picture in public response', async () => {
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Item 1', price: 10 }
      ], { sharedWith: [bob._id] });
      const agent = await loginAs(alice);

      // Generate invite link
      const genRes = await agent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      // Bob claims an item
      const bobAgent = await loginAs(bob);
      const itemId = wishlist.items[0]._id;
      await bobAgent
        .post(`/api/share/claim/${wishlist._id}/${itemId}`)
        .expect(200);

      // Public view shows the claimer's identity so others can coordinate
      const { request } = createUnauthenticatedRequest();
      const res = await request
        .get(`/api/public/invite/${genRes.body.token}`)
        .expect(200);

      const item = res.body.items[0];
      expect(item.isClaimed).toBe(true);
      expect(item.status?.claimedBy?.name).toBe(bob.name);
      expect(item.isAnonymousClaim).toBe(false);
    });
  });

  describe('Join via Invite', () => {
    it('should add authenticated user to sharedWith', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      const bobAgent = await loginAs(bob);
      const joinRes = await bobAgent
        .post(`/api/public/invite/${genRes.body.token}/join`)
        .expect(200);

      expect(joinRes.body.listId).toBeDefined();

      // Verify bob is now in sharedWith
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.sharedWith.map(id => id.toString())).toContain(bob._id.toString());
    });

    it('should return 401 for unauthenticated join', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      const { request } = createUnauthenticatedRequest();
      await request
        .post(`/api/public/invite/${genRes.body.token}/join`)
        .expect(401);
    });

    it('should not duplicate user in sharedWith', async () => {
      const wishlist = await createWishlistWithItems(alice, [], {
        sharedWith: [bob._id]
      });
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      const bobAgent = await loginAs(bob);
      await bobAgent
        .post(`/api/public/invite/${genRes.body.token}/join`)
        .expect(200);

      const updated = await Wishlist.findById(wishlist._id);
      const bobEntries = updated.sharedWith.filter(id => id.toString() === bob._id.toString());
      expect(bobEntries.length).toBe(1);
    });

    it('should not let owner join their own list', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      await aliceAgent
        .post(`/api/public/invite/${genRes.body.token}/join`)
        .expect(400);
    });
  });

  describe('Anonymous Claims', () => {
    it('should allow anonymous claim when enabled', async () => {
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 25 }
      ]);
      const aliceAgent = await loginAs(alice);

      // Generate link and enable anonymous claims
      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      await aliceAgent
        .put(`/api/share/${wishlist._id}/anonymous-claims`)
        .send({ allow: true })
        .expect(200);

      // Anonymous claim
      const { request } = createUnauthenticatedRequest();
      const res = await request
        .post(`/api/public/invite/${genRes.body.token}/claim/${wishlist.items[0]._id}`)
        .send({ claimerName: 'John' })
        .expect(200);

      expect(res.body.isClaimed).toBe(true);
      expect(res.body.status?.claimedBy?.name).toBe('John');
      expect(res.body.isAnonymousClaim).toBe(true);
    });

    it('should reject anonymous claim when disabled', async () => {
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 25 }
      ]);
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      // Anonymous claims not enabled (default is false)
      const { request } = createUnauthenticatedRequest();
      await request
        .post(`/api/public/invite/${genRes.body.token}/claim/${wishlist.items[0]._id}`)
        .send({ claimerName: 'John' })
        .expect(401);
    });

    it('should require claimer name for anonymous claims', async () => {
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 25 }
      ]);
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      await aliceAgent
        .put(`/api/share/${wishlist._id}/anonymous-claims`)
        .send({ allow: true })
        .expect(200);

      const { request } = createUnauthenticatedRequest();
      await request
        .post(`/api/public/invite/${genRes.body.token}/claim/${wishlist.items[0]._id}`)
        .send({})
        .expect(400);
    });

    it('should prevent claiming already-claimed items', async () => {
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 25 }
      ]);
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      await aliceAgent
        .put(`/api/share/${wishlist._id}/anonymous-claims`)
        .send({ allow: true })
        .expect(200);

      const { request: req1 } = createUnauthenticatedRequest();
      await req1
        .post(`/api/public/invite/${genRes.body.token}/claim/${wishlist.items[0]._id}`)
        .send({ claimerName: 'John' })
        .expect(200);

      const { request: req2 } = createUnauthenticatedRequest();
      await req2
        .post(`/api/public/invite/${genRes.body.token}/claim/${wishlist.items[0]._id}`)
        .send({ claimerName: 'Jane' })
        .expect(400);
    });
  });

  describe('Authenticated Claims via Invite', () => {
    it('should auto-join user when claiming via invite link', async () => {
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 25 }
      ]);
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      // Bob claims without being in sharedWith - should auto-join
      const bobAgent = await loginAs(bob);
      await bobAgent
        .post(`/api/public/invite/${genRes.body.token}/claim/${wishlist.items[0]._id}`)
        .expect(200);

      // Verify bob was added to sharedWith
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.sharedWith.map(id => id.toString())).toContain(bob._id.toString());
    });

    it('should allow authenticated user to toggle claim', async () => {
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Test Item', price: 25 }
      ], { sharedWith: [bob._id] });
      const aliceAgent = await loginAs(alice);

      const genRes = await aliceAgent
        .post(`/api/share/${wishlist._id}/invite-link`)
        .expect(200);

      const bobAgent = await loginAs(bob);

      // Claim
      const claimRes = await bobAgent
        .post(`/api/public/invite/${genRes.body.token}/claim/${wishlist.items[0]._id}`)
        .expect(200);
      expect(claimRes.body.isClaimed).toBe(true);

      // Unclaim
      const unclaimRes = await bobAgent
        .post(`/api/public/invite/${genRes.body.token}/claim/${wishlist.items[0]._id}`)
        .expect(200);
      expect(unclaimRes.body.isClaimed).toBe(false);
    });
  });

  describe('Anonymous Claims Toggle', () => {
    it('should toggle anonymous claims setting', async () => {
      const wishlist = await createWishlistWithItems(alice);
      const agent = await loginAs(alice);

      const res1 = await agent
        .put(`/api/share/${wishlist._id}/anonymous-claims`)
        .send({ allow: true })
        .expect(200);
      expect(res1.body.allowAnonymousClaims).toBe(true);

      const res2 = await agent
        .put(`/api/share/${wishlist._id}/anonymous-claims`)
        .send({ allow: false })
        .expect(200);
      expect(res2.body.allowAnonymousClaims).toBe(false);
    });

    it('should only allow owner to toggle anonymous claims', async () => {
      const wishlist = await createWishlistWithItems(alice, [], {
        sharedWith: [bob._id]
      });
      const agent = await loginAs(bob);

      await agent
        .put(`/api/share/${wishlist._id}/anonymous-claims`)
        .send({ allow: true })
        .expect(404);
    });
  });
});
