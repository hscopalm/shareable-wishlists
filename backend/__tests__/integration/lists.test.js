const { loginAs, createUnauthenticatedRequest } = require('../helpers/auth');
const { createUser, createTestUsers } = require('../fixtures/users');
const { createWishlist, createWishlistWithItems, createSharedWishlist } = require('../fixtures/wishlists');
const Wishlist = require('../../models/Wishlist');
const ActivityLog = require('../../models/ActivityLog');

describe('Lists Routes', () => {
  describe('GET /api/lists - Get all lists', () => {
    it('should return empty array for user with no lists', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);

      const res = await agent.get('/api/lists');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return only the current user\'s lists', async () => {
      const { alice, bob } = await createTestUsers();
      await createWishlist(alice, { name: 'Alice List 1' });
      await createWishlist(alice, { name: 'Alice List 2' });
      await createWishlist(bob, { name: 'Bob List' });

      const agent = await loginAs(alice);
      const res = await agent.get('/api/lists');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every(l => l.user.toString() === alice._id.toString())).toBe(true);
    });

    it('should return lists sorted by createdAt descending', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });

      // Create lists with a small delay to ensure different timestamps
      const list1 = await createWishlist(alice, { name: 'First' });
      const list2 = await createWishlist(alice, { name: 'Second' });
      const list3 = await createWishlist(alice, { name: 'Third' });

      const agent = await loginAs(alice);
      const res = await agent.get('/api/lists');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      // Most recent should be first
      expect(res.body[0].name).toBe('Third');
    });

    it('should require authentication', async () => {
      const { request } = createUnauthenticatedRequest();

      const res = await request.get('/api/lists');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/lists - Create a list', () => {
    it('should create a new list with required fields', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);

      const res = await agent
        .post('/api/lists')
        .send({ name: 'My Birthday List' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Birthday List');
      expect(res.body.user.toString()).toBe(alice._id.toString());
      expect(res.body.items).toHaveLength(0);

      // Verify in database
      const saved = await Wishlist.findById(res.body._id);
      expect(saved).toBeTruthy();
      expect(saved.name).toBe('My Birthday List');
    });

    it('should create a list with all fields', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);
      const eventDate = new Date('2025-06-15');

      const res = await agent
        .post('/api/lists')
        .send({
          name: 'Christmas List',
          description: 'Things I want for Christmas',
          event_date: eventDate.toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Christmas List');
      expect(res.body.description).toBe('Things I want for Christmas');
      expect(new Date(res.body.event_date).toDateString()).toBe(eventDate.toDateString());
    });

    it('should fail without required name field', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);

      const res = await agent
        .post('/api/lists')
        .send({ description: 'No name provided' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/lists/:id - Get single list', () => {
    it('should return list details for owner', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlistWithItems(alice, [
        { title: 'Item 1' },
        { title: 'Item 2' }
      ], { name: 'My List' });
      const agent = await loginAs(alice);

      const res = await agent.get(`/api/lists/${wishlist._id}`);

      expect(res.status).toBe(200);
      expect(res.body.list.name).toBe('My List');
      expect(res.body.items).toHaveLength(2);
      expect(res.body.isShared).toBe(false);
    });

    it('should return list details for shared user', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob], { name: 'Shared List' });
      const agent = await loginAs(bob);

      const res = await agent.get(`/api/lists/${wishlist._id}`);

      expect(res.status).toBe(200);
      expect(res.body.list.name).toBe('Shared List');
      expect(res.body.isShared).toBe(true);
    });

    it('should log view activity', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      await agent.get(`/api/lists/${wishlist._id}`);

      const log = await ActivityLog.findOne({
        action: 'view_list',
        wishlist: wishlist._id
      });
      expect(log).toBeTruthy();
      expect(log.causer.toString()).toBe(alice._id.toString());
    });

    it('should return 404 for non-shared user', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlist(alice, { name: 'Private List' });
      const agent = await loginAs(bob); // Bob is not owner or shared user

      const res = await agent.get(`/api/lists/${wishlist._id}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent list', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await agent.get(`/api/lists/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/lists/:id - Update list', () => {
    it('should update list for owner', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice, { name: 'Original Name' });
      const agent = await loginAs(alice);

      const res = await agent
        .put(`/api/lists/${wishlist._id}`)
        .send({
          name: 'Updated Name',
          description: 'New description',
          event_date: new Date('2025-07-01')
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.description).toBe('New description');
    });

    it('should not allow shared user to update list', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob], { name: 'Original' });
      const agent = await loginAs(bob);

      const res = await agent
        .put(`/api/lists/${wishlist._id}`)
        .send({ name: 'Bob Tries to Update' });

      expect(res.status).toBe(404);

      // Verify not updated
      const unchanged = await Wishlist.findById(wishlist._id);
      expect(unchanged.name).toBe('Original');
    });

    it('should not allow non-owner to update list', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlist(alice, { name: 'Original' });
      const agent = await loginAs(bob);

      const res = await agent
        .put(`/api/lists/${wishlist._id}`)
        .send({ name: 'Hack Attempt' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/lists/:id - Delete list', () => {
    it('should delete list for owner', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(alice);

      const res = await agent.delete(`/api/lists/${wishlist._id}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('List deleted successfully');

      // Verify deleted
      const deleted = await Wishlist.findById(wishlist._id);
      expect(deleted).toBeNull();
    });

    it('should not allow shared user to delete list', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createSharedWishlist(alice, [bob]);
      const agent = await loginAs(bob);

      const res = await agent.delete(`/api/lists/${wishlist._id}`);

      expect(res.status).toBe(404);

      // Verify not deleted
      const stillExists = await Wishlist.findById(wishlist._id);
      expect(stillExists).toBeTruthy();
    });

    it('should not allow non-owner to delete list', async () => {
      const { alice, bob } = await createTestUsers();
      const wishlist = await createWishlist(alice);
      const agent = await loginAs(bob);

      const res = await agent.delete(`/api/lists/${wishlist._id}`);

      expect(res.status).toBe(404);
    });
  });
});
