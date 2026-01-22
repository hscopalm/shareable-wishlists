const Wishlist = require('../../../models/Wishlist');
const { createUser } = require('../../fixtures/users');

describe('Wishlist Model', () => {
  describe('Virtual: archiveDate', () => {
    it('should return 3 months after creation when no event date', async () => {
      const user = await createUser();
      const createdAt = new Date('2024-01-15');

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        createdAt
      });

      const archiveDate = wishlist.archiveDate;
      const expected = new Date('2024-04-15'); // 3 months later

      expect(archiveDate.getFullYear()).toBe(expected.getFullYear());
      expect(archiveDate.getMonth()).toBe(expected.getMonth());
      expect(archiveDate.getDate()).toBe(expected.getDate());
    });

    it('should return 1 month after event date when that is later', async () => {
      const user = await createUser();
      const createdAt = new Date('2024-01-01');
      const eventDate = new Date('2024-06-15'); // Event is way in the future

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        createdAt,
        event_date: eventDate
      });

      const archiveDate = wishlist.archiveDate;
      const expected = new Date('2024-07-15'); // 1 month after event

      expect(archiveDate.getFullYear()).toBe(expected.getFullYear());
      expect(archiveDate.getMonth()).toBe(expected.getMonth());
      expect(archiveDate.getDate()).toBe(expected.getDate());
    });

    it('should return 3 months after creation when that is later than 1 month after event', async () => {
      const user = await createUser();
      const createdAt = new Date('2024-01-15');
      const eventDate = new Date('2024-01-20'); // Event is soon after creation

      // 3 months after creation: April 15
      // 1 month after event: Feb 20
      // April 15 is later

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        createdAt,
        event_date: eventDate
      });

      const archiveDate = wishlist.archiveDate;

      // 3 months after Jan 15 = April 15, which is later than Feb 20
      // So archiveDate should be based on 3 months after creation
      const threeMonthsAfterCreation = new Date(createdAt);
      threeMonthsAfterCreation.setMonth(threeMonthsAfterCreation.getMonth() + 3);

      expect(archiveDate.getTime()).toBe(threeMonthsAfterCreation.getTime());
    });
  });

  describe('Virtual: isArchived', () => {
    it('should return false for recently created list', async () => {
      const user = await createUser();

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        createdAt: new Date() // Created now
      });

      expect(wishlist.isArchived).toBe(false);
    });

    it('should return true for old list past archive date', async () => {
      const user = await createUser();
      // Created 6 months ago
      const createdAt = new Date();
      createdAt.setMonth(createdAt.getMonth() - 6);

      const wishlist = new Wishlist({
        name: 'Old List',
        user: user._id,
        createdAt
      });

      expect(wishlist.isArchived).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should require a name', async () => {
      const user = await createUser();

      const wishlist = new Wishlist({
        user: user._id
        // No name provided
      });

      await expect(wishlist.validate()).rejects.toThrow();
    });

    it('should require a user', async () => {
      const wishlist = new Wishlist({
        name: 'Test List'
        // No user provided
      });

      await expect(wishlist.validate()).rejects.toThrow();
    });

    it('should enforce item priority range (1-5)', async () => {
      const user = await createUser();

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        items: [{
          title: 'Test Item',
          priority: 10 // Invalid: should be 1-5
        }]
      });

      await expect(wishlist.validate()).rejects.toThrow();
    });

    it('should allow valid priority values', async () => {
      const user = await createUser();

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        items: [
          { title: 'Item 1', priority: 1 },
          { title: 'Item 2', priority: 3 },
          { title: 'Item 3', priority: 5 }
        ]
      });

      await expect(wishlist.validate()).resolves.not.toThrow();
    });

    it('should require title for items', async () => {
      const user = await createUser();

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        items: [{
          description: 'No title'
          // title is missing
        }]
      });

      await expect(wishlist.validate()).rejects.toThrow();
    });
  });

  describe('JSON output', () => {
    it('should include virtuals when converted to JSON', async () => {
      const user = await createUser();

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id
      });

      const json = wishlist.toJSON();

      expect(json).toHaveProperty('archiveDate');
      expect(json).toHaveProperty('isArchived');
    });
  });

  describe('Items subdocument', () => {
    it('should generate _id for each item', async () => {
      const user = await createUser();

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        items: [
          { title: 'Item 1' },
          { title: 'Item 2' }
        ]
      });

      await wishlist.save();

      expect(wishlist.items[0]._id).toBeDefined();
      expect(wishlist.items[1]._id).toBeDefined();
      expect(wishlist.items[0]._id.toString()).not.toBe(wishlist.items[1]._id.toString());
    });

    it('should track claim status', async () => {
      const user = await createUser();
      const claimer = await createUser({ email: 'claimer@test.com' });

      const wishlist = new Wishlist({
        name: 'Test List',
        user: user._id,
        items: [{
          title: 'Claimed Item',
          status: {
            claimedBy: claimer._id,
            claimedAt: new Date()
          }
        }]
      });

      await wishlist.save();

      expect(wishlist.items[0].status.claimedBy.toString()).toBe(claimer._id.toString());
      expect(wishlist.items[0].status.claimedAt).toBeDefined();
    });
  });
});
