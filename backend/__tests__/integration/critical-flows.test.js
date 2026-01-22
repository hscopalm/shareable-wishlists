/**
 * Critical Flow Tests
 *
 * These tests cover high-risk scenarios that could cause real user problems
 * if they break. They're separated from routine CRUD tests for visibility.
 */

const { loginAs, createUnauthenticatedRequest } = require('../helpers/auth');
const { createUser, createTestUsers } = require('../fixtures/users');
const { createWishlist, createWishlistWithItems, createSharedWishlist } = require('../fixtures/wishlists');
const Wishlist = require('../../models/Wishlist');
const User = require('../../models/User');

describe('Critical Flows', () => {

  /**
   * EMAIL VALIDATION ON SHARE
   *
   * When sharing a list, the email should be validated before creating
   * a pending user. Invalid emails waste database space and will never
   * convert to real users.
   */
  describe('Email Validation', () => {

    it('should reject invalid email format when sharing', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post(`/api/share/${wishlist._id}`)
        .send({ email: 'not-a-valid-email' });

      expect(res.status).toBe(400);

      // Should not create a pending user with invalid email
      const badUser = await User.findOne({ email: 'not-a-valid-email' });
      expect(badUser).toBeNull();
    });

    it('should reject empty email when sharing', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post(`/api/share/${wishlist._id}`)
        .send({ email: '' });

      expect(res.status).toBe(400);
    });

    it('should reject email with only spaces', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent
        .post(`/api/share/${wishlist._id}`)
        .send({ email: '   ' });

      expect(res.status).toBe(400);
    });
  });

  /**
   * PENDING USER CONVERSION FLOW
   *
   * This tests the invitation flow:
   * 1. Alice shares a list with bob@example.com (Bob doesn't exist)
   * 2. System creates a "pending" user for Bob
   * 3. Bob later signs up with Google OAuth
   * 4. Bob should see the list that was shared with him
   *
   * WHY THIS MATTERS:
   * If this breaks, invited users lose access to all lists shared with them
   * before they signed up. This is a core feature of the app.
   *
   * HOW IT WORKS:
   * The sharedWith array stores ObjectIds. When Bob signs up, Passport finds
   * the pending user by email and updates it (adds googleId, name, etc.).
   * The ObjectId stays the same, so the sharedWith reference remains valid.
   *
   * WHAT WE TEST:
   * We simulate the OAuth conversion by updating the pending user the same
   * way Passport does, then verify the converted user can access shared lists.
   */
  describe('Pending User → OAuth Conversion', () => {

    it('should allow converted user to access lists shared before signup', async () => {
      // Step 1: Alice creates a list and shares with an email that doesn't exist
      const alice = await createUser({
        email: 'alice@test.com',
        name: 'Alice',
        googleId: 'google-alice'
      });
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Gift Item 1' },
        { title: 'Gift Item 2' }
      ], { name: 'Birthday Wishlist' });

      const aliceAgent = await loginAs(alice);
      const bobEmail = 'bob-pending@test.com';

      // Share with Bob (who doesn't exist yet)
      const shareRes = await aliceAgent
        .post(`/api/share/${wishlist._id}`)
        .send({ email: bobEmail });

      expect(shareRes.status).toBe(200);
      expect(shareRes.body.isPending).toBe(true);

      // Step 2: Verify pending user was created and added to sharedWith
      const pendingBob = await User.findOne({ email: bobEmail });
      expect(pendingBob).toBeTruthy();
      expect(pendingBob.isPending).toBe(true);
      expect(pendingBob.googleId).toBeUndefined();
      expect(pendingBob.name).toBeUndefined();

      const wishlistWithSharing = await Wishlist.findById(wishlist._id);
      expect(wishlistWithSharing.sharedWith.map(id => id.toString()))
        .toContain(pendingBob._id.toString());

      // Step 3: Simulate Bob signing up via Google OAuth
      // This is what Passport does in config/passport.js lines 44-52
      pendingBob.googleId = 'google-bob-123';
      pendingBob.name = 'Bob Smith';
      pendingBob.picture = 'https://example.com/bob.jpg';
      pendingBob.isPending = false;
      await pendingBob.save();

      // Step 4: Bob (now a full user) should be able to access the shared list
      const bobAgent = await loginAs(pendingBob);

      const listRes = await bobAgent.get(`/api/lists/${wishlist._id}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.list.name).toBe('Birthday Wishlist');
      expect(listRes.body.isShared).toBe(true);
      expect(listRes.body.items).toHaveLength(2);
    });

    it('should allow converted user to see all lists shared before signup', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const charlie = await createUser({ email: 'charlie@test.com', name: 'Charlie' });
      const bobEmail = 'bob-multi@test.com';

      // Alice and Charlie both share lists with Bob before he signs up
      const aliceList = await createWishlist(alice, { name: 'Alice List' });
      const charlieList = await createWishlist(charlie, { name: 'Charlie List' });

      const aliceAgent = await loginAs(alice);
      await aliceAgent.post(`/api/share/${aliceList._id}`).send({ email: bobEmail });

      const charlieAgent = await loginAs(charlie);
      await charlieAgent.post(`/api/share/${charlieList._id}`).send({ email: bobEmail });

      // Bob signs up
      const pendingBob = await User.findOne({ email: bobEmail });
      pendingBob.googleId = 'google-bob';
      pendingBob.name = 'Bob';
      pendingBob.isPending = false;
      await pendingBob.save();

      // Bob should see both lists
      const bobAgent = await loginAs(pendingBob);
      const sharedRes = await bobAgent.get('/api/share/shared-with-me');

      expect(sharedRes.status).toBe(200);
      expect(sharedRes.body).toHaveLength(2);

      const listNames = sharedRes.body.map(l => l.name);
      expect(listNames).toContain('Alice List');
      expect(listNames).toContain('Charlie List');
    });

    it('should allow converted user to claim items', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Claimable Item' }
      ]);
      const bobEmail = 'bob-claimer@test.com';

      // Share before Bob exists
      const aliceAgent = await loginAs(alice);
      await aliceAgent.post(`/api/share/${wishlist._id}`).send({ email: bobEmail });

      // Bob signs up
      const pendingBob = await User.findOne({ email: bobEmail });
      pendingBob.googleId = 'google-bob';
      pendingBob.name = 'Bob';
      pendingBob.isPending = false;
      await pendingBob.save();

      // Bob should be able to claim
      const bobAgent = await loginAs(pendingBob);
      const itemId = wishlist.items[0]._id;

      const claimRes = await bobAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`);

      expect(claimRes.status).toBe(200);

      // Verify claim persisted
      const updated = await Wishlist.findById(wishlist._id);
      expect(updated.items[0].status.claimedBy.toString()).toBe(pendingBob._id.toString());
    });
  });

  /**
   * CONCURRENT CLAIM RACE CONDITION
   *
   * This tests what happens when two users try to claim the same item
   * at the same time.
   *
   * WHY THIS MATTERS:
   * The entire point of this app is to prevent two people from buying
   * the same gift. If both claims succeed, the app has failed its core purpose.
   *
   * HOW THE BUG OCCURS:
   * The current code does: check if claimed → if not, claim → save
   * Two requests can both pass the check before either saves.
   *
   * WHAT WE TEST:
   * Fire two claim requests simultaneously, then verify:
   * - Only ONE user ends up as the claimer in the database
   * - At least one request got a failure response
   *
   * NOTE: This test documents EXPECTED behavior. If it fails, there's a
   * race condition bug that needs fixing (e.g., with optimistic locking
   * or atomic updates).
   */
  describe('Concurrent Claim Race Condition', () => {

    it('should only allow one user to claim when two claim simultaneously', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const bob = await createUser({ email: 'bob@test.com', name: 'Bob' });
      const charlie = await createUser({ email: 'charlie@test.com', name: 'Charlie' });

      // Alice creates a list with one item, shared with Bob and Charlie
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Contested Item', price: 100 }
      ]);
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();

      const itemId = wishlist.items[0]._id;

      // Get authenticated agents for both users
      const bobAgent = await loginAs(bob);
      const charlieAgent = await loginAs(charlie);

      // Fire both claim requests simultaneously
      const [bobResult, charlieResult] = await Promise.all([
        bobAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`),
        charlieAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`)
      ]);

      // Count successes and failures
      const successCount = [bobResult, charlieResult].filter(r => r.status === 200).length;
      const failCount = [bobResult, charlieResult].filter(r => r.status === 400).length;

      // REQUIRED: exactly one success, one failure
      // If both succeed, there's a race condition - two people think they bought the gift
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Verify only one claimer in database
      const finalWishlist = await Wishlist.findById(wishlist._id);
      const claimedBy = finalWishlist.items[0].status.claimedBy;
      expect(claimedBy).toBeDefined();

      // The successful responder should match the database
      const claimerId = claimedBy.toString();
      if (bobResult.status === 200) {
        expect(claimerId).toBe(bob._id.toString());
      } else {
        expect(claimerId).toBe(charlie._id.toString());
      }
    });

    it('should handle rapid sequential claims correctly', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const bob = await createUser({ email: 'bob@test.com', name: 'Bob' });
      const charlie = await createUser({ email: 'charlie@test.com', name: 'Charlie' });

      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Sequential Item' }
      ]);
      wishlist.sharedWith.push(bob._id, charlie._id);
      await wishlist.save();

      const itemId = wishlist.items[0]._id;
      const bobAgent = await loginAs(bob);
      const charlieAgent = await loginAs(charlie);

      // Bob claims first (sequentially, not parallel)
      const bobResult = await bobAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`);
      expect(bobResult.status).toBe(200);

      // Charlie tries to claim after Bob - should fail
      const charlieResult = await charlieAgent.post(`/api/share/claim/${wishlist._id}/${itemId}`);
      expect(charlieResult.status).toBe(400);
      expect(charlieResult.body.message).toBe('Item already claimed by someone else');

      // Verify Bob is still the claimer
      const finalWishlist = await Wishlist.findById(wishlist._id);
      expect(finalWishlist.items[0].status.claimedBy.toString()).toBe(bob._id.toString());
    });
  });
});
