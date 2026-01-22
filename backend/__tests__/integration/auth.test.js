const supertest = require('supertest');
const { createTestAppWithAuth, loginAs, createUnauthenticatedRequest } = require('../helpers/auth');
const { createUser, createTestUsers } = require('../fixtures/users');

describe('Auth Routes', () => {
  describe('GET /api/auth/test', () => {
    it('should return success message', async () => {
      const { request } = createUnauthenticatedRequest();

      const res = await request.get('/api/auth/test');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Auth routes working!');
    });
  });

  describe('GET /api/auth/current-user', () => {
    it('should return user data when authenticated', async () => {
      const alice = await createUser({
        email: 'alice@test.com',
        name: 'Alice',
        picture: 'https://example.com/alice.jpg'
      });
      const agent = await loginAs(alice);

      const res = await agent.get('/api/auth/current-user');

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@test.com');
      expect(res.body.name).toBe('Alice');
    });

    it('should return 401 when not authenticated', async () => {
      const { request } = createUnauthenticatedRequest();

      const res = await request.get('/api/auth/current-user');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authenticated');
    });
  });

  describe('GET /api/auth/logout', () => {
    it('should logout authenticated user', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);

      // Verify logged in first
      let res = await agent.get('/api/auth/current-user');
      expect(res.status).toBe(200);

      // Logout
      res = await agent.get('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');

      // Verify no longer authenticated
      res = await agent.get('/api/auth/current-user');
      expect(res.status).toBe(401);
    });
  });

  describe('Session persistence', () => {
    it('should maintain session across multiple requests', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);

      // Make multiple requests and verify session is maintained
      let res = await agent.get('/api/auth/current-user');
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@test.com');

      // Second request should also work
      res = await agent.get('/api/auth/current-user');
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@test.com');

      // Third request
      res = await agent.get('/api/auth/current-user');
      expect(res.status).toBe(200);
    });
  });

  describe('Protected routes', () => {
    it('should reject unauthenticated access to protected routes', async () => {
      const { request } = createUnauthenticatedRequest();

      // Lists route is protected
      const res = await request.get('/api/lists');

      expect(res.status).toBe(401);
    });

    it('should allow authenticated access to protected routes', async () => {
      const alice = await createUser({ email: 'alice@test.com', name: 'Alice' });
      const agent = await loginAs(alice);

      const res = await agent.get('/api/lists');

      expect(res.status).toBe(200);
    });
  });
});
