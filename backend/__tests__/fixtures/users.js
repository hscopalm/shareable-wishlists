const User = require('../../models/User');

// Factory function to create a user with default values
async function createUser(overrides = {}) {
  const defaults = {
    email: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`,
    name: 'Test User',
    googleId: `google-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    picture: 'https://example.com/picture.jpg',
    isPending: false
  };

  const userData = { ...defaults, ...overrides };
  const user = new User(userData);
  await user.save();
  return user;
}

// Create a pending user (invited but not signed up)
async function createPendingUser(email) {
  return createUser({
    email,
    name: undefined,
    googleId: undefined,
    picture: undefined,
    isPending: true
  });
}

// Pre-defined test users for consistent test scenarios
const testUserData = {
  alice: {
    email: 'alice@test.com',
    name: 'Alice Johnson',
    googleId: 'google-alice-123',
    picture: 'https://example.com/alice.jpg',
    isPending: false
  },
  bob: {
    email: 'bob@test.com',
    name: 'Bob Smith',
    googleId: 'google-bob-456',
    picture: 'https://example.com/bob.jpg',
    isPending: false
  },
  charlie: {
    email: 'charlie@test.com',
    name: 'Charlie Brown',
    googleId: 'google-charlie-789',
    picture: 'https://example.com/charlie.jpg',
    isPending: false
  }
};

// Create pre-defined test users
async function createTestUsers() {
  const alice = await createUser(testUserData.alice);
  const bob = await createUser(testUserData.bob);
  const charlie = await createUser(testUserData.charlie);
  return { alice, bob, charlie };
}

module.exports = {
  createUser,
  createPendingUser,
  createTestUsers,
  testUserData
};
