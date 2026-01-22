const express = require('express');
const session = require('express-session');
const passport = require('passport');

// Create a test-ready Express app with all middleware and routes configured
function createTestApp() {
  const app = express();

  // Basic middleware
  app.use(express.json());

  // Session middleware (in-memory for tests)
  app.use(session({
    secret: 'test-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

  // Passport initialization
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport serialization for tests
  const User = require('../../models/User');

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  // Auth middleware
  const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Not authenticated' });
  };

  // Import routes
  const authRoutes = require('../../routes/auth');
  const wishlistRoutes = require('../../routes/wishlist');
  const sharingRoutes = require('../../routes/sharing');
  const adminRoutes = require('../../routes/admin');
  const listRoutes = require('../../routes/lists');

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/wishlist', requireAuth, wishlistRoutes);
  app.use('/api', requireAuth, sharingRoutes);
  app.use('/api/admin', requireAuth, adminRoutes);
  app.use('/api/lists', requireAuth, listRoutes);

  return app;
}

module.exports = { createTestApp };
