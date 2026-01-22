const User = require('../../../models/User');

describe('User Model', () => {
  // Ensure indexes are created before tests
  beforeAll(async () => {
    await User.createIndexes();
  });
  describe('Validation', () => {
    it('should require email', async () => {
      const user = new User({
        name: 'Test User',
        googleId: 'google123'
        // No email
      });

      await expect(user.validate()).rejects.toThrow();
    });

    it('should allow user with just email (pending user)', async () => {
      const user = new User({
        email: 'pending@test.com',
        isPending: true
      });

      await expect(user.validate()).resolves.not.toThrow();
    });

    it('should allow full user with all fields', async () => {
      const user = new User({
        email: 'full@test.com',
        name: 'Full User',
        googleId: 'google123',
        picture: 'https://example.com/pic.jpg',
        isPending: false
      });

      await expect(user.validate()).resolves.not.toThrow();
    });
  });

  describe('Email uniqueness', () => {
    it('should enforce unique email constraint', async () => {
      const user1 = new User({
        email: 'unique@test.com',
        name: 'User 1'
      });
      await user1.save();

      const user2 = new User({
        email: 'unique@test.com', // Same email
        name: 'User 2'
      });

      await expect(user2.save()).rejects.toThrow();
    });

    it('should allow different emails', async () => {
      const user1 = new User({
        email: 'user1@test.com',
        name: 'User 1'
      });
      await user1.save();

      const user2 = new User({
        email: 'user2@test.com', // Different email
        name: 'User 2'
      });

      await expect(user2.save()).resolves.toBeDefined();
    });
  });

  describe('Google ID uniqueness', () => {
    it('should enforce unique googleId constraint', async () => {
      const user1 = new User({
        email: 'user1@test.com',
        googleId: 'same-google-id'
      });
      await user1.save();

      const user2 = new User({
        email: 'user2@test.com',
        googleId: 'same-google-id' // Same googleId
      });

      await expect(user2.save()).rejects.toThrow();
    });

    it('should allow users without googleId (sparse index)', async () => {
      const user1 = new User({
        email: 'pending1@test.com',
        isPending: true
        // No googleId
      });
      await user1.save();

      const user2 = new User({
        email: 'pending2@test.com',
        isPending: true
        // No googleId
      });

      // Should work because sparse index allows multiple nulls
      await expect(user2.save()).resolves.toBeDefined();
    });
  });

  describe('Default values', () => {
    it('should default isPending to false', async () => {
      const user = new User({
        email: 'test@test.com',
        name: 'Test User'
      });

      expect(user.isPending).toBe(false);
    });

    it('should set createdAt to current date by default', async () => {
      const before = new Date();
      const user = new User({
        email: 'test@test.com',
        name: 'Test User'
      });
      const after = new Date();

      expect(user.createdAt).toBeDefined();
      expect(user.createdAt >= before).toBe(true);
      expect(user.createdAt <= after).toBe(true);
    });
  });

  describe('Pending user flow', () => {
    it('should support creating pending user and updating with OAuth info', async () => {
      // Create pending user (invited via email)
      const pendingUser = new User({
        email: 'invited@test.com',
        isPending: true
      });
      await pendingUser.save();

      expect(pendingUser.isPending).toBe(true);
      expect(pendingUser.googleId).toBeUndefined();
      expect(pendingUser.name).toBeUndefined();

      // User signs up with Google OAuth
      pendingUser.googleId = 'google-oauth-id';
      pendingUser.name = 'Invited User';
      pendingUser.picture = 'https://example.com/avatar.jpg';
      pendingUser.isPending = false;
      await pendingUser.save();

      // Verify update
      const updatedUser = await User.findById(pendingUser._id);
      expect(updatedUser.isPending).toBe(false);
      expect(updatedUser.googleId).toBe('google-oauth-id');
      expect(updatedUser.name).toBe('Invited User');
    });
  });
});
