const { loginAs } = require('../helpers/auth');
const { createUser, createTestUsers } = require('../fixtures/users');
const { createWishlist, createWishlistWithItems } = require('../fixtures/wishlists');
const Wishlist = require('../../models/Wishlist');

async function createCashItem(owner, paymentLinks, extras = {}) {
  return createWishlistWithItems(owner, [{
    type: 'cash',
    title: extras.title || 'Honeymoon Fund',
    description: extras.description,
    paymentLinks
  }]);
}

describe('Cash items', () => {
  describe('Create', () => {
    it('creates a cash item with one handle and exposes paymentUrls', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent.post('/api/wishlist').send({
        list: wishlist._id,
        type: 'cash',
        title: 'Honeymoon Fund',
        paymentLinks: { venmo: 'harry-palmer' }
      });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('cash');
      expect(res.body.title).toBe('Honeymoon Fund');
      expect(res.body.paymentLinks.venmo).toBe('harry-palmer');
      expect(res.body.paymentUrls.venmo).toBe('https://venmo.com/u/harry-palmer');
    });

    it('rejects a cash item with no handles', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent.post('/api/wishlist').send({
        list: wishlist._id,
        type: 'cash',
        title: 'Empty',
        paymentLinks: {}
      });

      expect(res.status).toBe(400);
    });

    it('strips @ and $ prefixes from handles on create', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent.post('/api/wishlist').send({
        list: wishlist._id,
        type: 'cash',
        title: 'Fund',
        paymentLinks: { venmo: '@harry', cashapp: '$harry' }
      });

      expect(res.status).toBe(201);
      expect(res.body.paymentLinks.venmo).toBe('harry');
      expect(res.body.paymentLinks.cashapp).toBe('harry');
      expect(res.body.paymentUrls.cashapp).toBe('https://cash.app/$harry');
    });

    it('strips gift fields from cash items', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent.post('/api/wishlist').send({
        list: wishlist._id,
        type: 'cash',
        title: 'Fund',
        price: 100,
        priority: 5,
        link: 'https://shouldbeignored.com',
        paymentLinks: { venmo: 'harry' }
      });

      expect(res.status).toBe(201);
      expect(res.body.price).toBeFalsy();
      expect(res.body.priority).toBeFalsy();
      expect(res.body.link).toBeFalsy();
    });
  });

  describe('Update', () => {
    it('updates paymentLinks on existing cash item', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createCashItem(alice, { venmo: 'old-handle' });
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent.put(`/api/wishlist/${itemId}`).send({
        paymentLinks: { venmo: 'new-handle' }
      });

      expect(res.status).toBe(200);
      expect(res.body.paymentLinks.venmo).toBe('new-handle');
      expect(res.body.paymentUrls.venmo).toBe('https://venmo.com/u/new-handle');
    });

    it('rejects attempt to change item type', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent.put(`/api/wishlist/${itemId}`).send({
        type: 'gift'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/type cannot be changed/i);
    });

    it('rejects update that removes all handles', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent.put(`/api/wishlist/${itemId}`).send({
        paymentLinks: {}
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Claim semantics', () => {
    it('allows two sharers to claim the same cash item concurrently without locking', async () => {
      const { alice, bob, charlie } = await createTestUsers();
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;

      const bobAgent = await loginAs(bob);
      const charlieAgent = await loginAs(charlie);

      const bobRes = await bobAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`);
      const charlieRes = await charlieAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`);

      expect(bobRes.status).toBe(200);
      expect(charlieRes.status).toBe(200);
      expect(charlieRes.body.claims).toHaveLength(2);

      const stored = await Wishlist.findById(wishlist._id);
      const item = stored.items.id(itemId);
      expect(item.claims).toHaveLength(2);
    });

    it('toggles a sharer claim off when tapped again', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const claimRes = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);
      expect(claimRes.body.claims).toHaveLength(1);

      const unclaimRes = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);
      expect(unclaimRes.status).toBe(200);
      expect(unclaimRes.body.claims).toHaveLength(0);
    });

    it('does not create duplicate entries when same user claims twice in a row', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      // First call adds an entry, second call (with explicit quantity=1)
      // should also be a no-op rather than appending a duplicate.
      await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`).send({ quantity: 1 });
      const res = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`).send({ quantity: 1 });

      expect(res.status).toBe(200);
      const myClaims = res.body.claims.filter(c => c.claimedBy?._id === bob._id.toString());
      expect(myClaims).toHaveLength(1);
    });

    it('owner cannot claim their own cash item', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(alice);

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Authorization', () => {
    it('shared user cannot edit paymentLinks', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent.put(`/api/wishlist/${itemId}`).send({
        paymentLinks: { venmo: 'bob-hijack' }
      });
      expect(res.status).toBe(404);

      const unchanged = await Wishlist.findById(wishlist._id);
      expect(unchanged.items[0].paymentLinks.venmo).toBe('harry');
    });

    it('shared user cannot delete a cash item', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      wishlist.sharedWith.push(bob._id);
      await wishlist.save();
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent.delete(`/api/wishlist/${itemId}`);
      expect(res.status).toBe(404);
    });

    it('non-shared user cannot claim a cash item', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      const itemId = wishlist.items[0]._id;
      const agent = await loginAs(bob);

      const res = await agent.post(`/api/share/claim/${wishlist._id}/${itemId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Anonymous claims via invite link', () => {
    it('records anonymous contribution when allowed', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      wishlist.allowAnonymousClaims = true;
      wishlist.inviteToken = 'test-token-cash-anon';
      wishlist.inviteLinkEnabled = true;
      await wishlist.save();

      const { createUnauthenticatedRequest } = require('../helpers/auth');
      const { request } = createUnauthenticatedRequest();
      const itemId = wishlist.items[0]._id;

      const res = await request
        .post(`/api/public/invite/test-token-cash-anon/claim/${itemId}`)
        .send({ claimerName: 'Sarah' });

      expect(res.status).toBe(200);
      expect(res.body.claims).toHaveLength(1);
      expect(res.body.claims[0].isAnonymousClaim).toBe(true);
      expect(res.body.claims[0].claimedBy.name).toBe('Sarah');
    });

    it('rejects anonymous contribution when not allowed', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createCashItem(alice, { venmo: 'harry' });
      wishlist.allowAnonymousClaims = false;
      wishlist.inviteToken = 'test-token-cash-noanon';
      wishlist.inviteLinkEnabled = true;
      await wishlist.save();

      const { createUnauthenticatedRequest } = require('../helpers/auth');
      const { request } = createUnauthenticatedRequest();
      const itemId = wishlist.items[0]._id;

      const res = await request
        .post(`/api/public/invite/test-token-cash-noanon/claim/${itemId}`)
        .send({ claimerName: 'Sarah' });

      expect(res.status).toBe(401);
    });
  });
});
