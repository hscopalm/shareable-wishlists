const supertest = require('supertest');
const { createTestApp } = require('./testApp');

// Create an authenticated agent for a given user
// This simulates a logged-in user session
async function createAuthenticatedAgent(user) {
  const app = createTestApp();
  const agent = supertest.agent(app);

  // Create a custom middleware to inject the user into the session
  // We'll use a test-only login route
  app.get('/test-login/:userId', async (req, res) => {
    const User = require('../../models/User');
    const testUser = await User.findById(req.params.userId);
    if (!testUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    req.login(testUser, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Login failed' });
      }
      res.json({ message: 'Logged in', user: testUser });
    });
  });

  // Perform the test login
  await agent.get(`/test-login/${user._id}`);

  return { app, agent };
}

// Create an unauthenticated request helper
function createUnauthenticatedRequest() {
  const app = createTestApp();
  return { app, request: supertest(app) };
}

// Helper to create a test app with a custom login route already mounted
function createTestAppWithAuth() {
  const app = createTestApp();

  // Add test login route
  app.get('/test-login/:userId', async (req, res) => {
    const User = require('../../models/User');
    const testUser = await User.findById(req.params.userId);
    if (!testUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    req.login(testUser, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Login failed' });
      }
      res.json({ message: 'Logged in', user: testUser });
    });
  });

  return app;
}

// Login as a specific user and return the agent
async function loginAs(user) {
  const app = createTestAppWithAuth();
  const agent = supertest.agent(app);
  await agent.get(`/test-login/${user._id}`);
  return agent;
}

module.exports = {
  createAuthenticatedAgent,
  createUnauthenticatedRequest,
  createTestAppWithAuth,
  loginAs
};
