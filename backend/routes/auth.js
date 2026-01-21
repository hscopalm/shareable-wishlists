const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working!' });
});

// Debug route to check headers and proxy settings
router.get('/debug', (req, res) => {
  res.json({
    headers: {
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-custom-header': req.headers['x-custom-header'] ? 'present' : 'missing',
      'host': req.headers['host'],
    },
    express: {
      protocol: req.protocol,
      secure: req.secure,
      ip: req.ip,
    },
    session: {
      id: req.sessionID,
      cookie: req.session?.cookie
    }
  });
});

// Development mode: Auto-login route
if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTO_LOGIN === 'true') {
  router.get('/dev-login', async (req, res) => {
    try {
      const devUser = await User.findOne({ email: process.env.DEV_USER_EMAIL || 'hscopalm@gmail.com' });
      if (!devUser) {
        return res.status(404).json({ message: 'Dev user not found. Run seed script first.' });
      }

      req.login(devUser, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error logging in', error: err.message });
        }
        res.json({ message: 'Development login successful', user: devUser });
      });
    } catch (error) {
      res.status(500).json({ message: 'Error finding dev user', error: error.message });
    }
  });
}

// In dev mode with auto-login, redirect /google to dev-login flow
if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTO_LOGIN === 'true') {
  router.get('/google', async (req, res) => {
    try {
      const devUser = await User.findOne({ email: process.env.DEV_USER_EMAIL || 'hscopalm@gmail.com' });
      if (!devUser) {
        return res.redirect(`${process.env.FRONTEND_URL}/?error=dev_user_not_found`);
      }

      req.login(devUser, (err) => {
        if (err) {
          return res.redirect(`${process.env.FRONTEND_URL}/?error=login_failed`);
        }

        // Explicitly save session before redirect
        req.session.save((saveErr) => {
          if (saveErr) {
            return res.redirect(`${process.env.FRONTEND_URL}/?error=session_save_failed`);
          }
          res.redirect(`${process.env.FRONTEND_URL}/`);
        });
      });
    } catch (error) {
      res.redirect(`${process.env.FRONTEND_URL}/?error=server_error`);
    }
  });

  router.get('/google/callback', (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/`);
  });
} else {
  router.get('/google', (req, res, next) => {
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: true
    })(req, res, next);
  });

  router.get('/google/callback',
    passport.authenticate('google', {
      failureRedirect: `${process.env.FRONTEND_URL}/`,
      session: true
    }),
    (req, res) => {
      // Explicitly save session before redirect to ensure it's persisted
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        }
        res.redirect(`${process.env.FRONTEND_URL}/`);
      });
    }
  );
}

router.get('/current-user', (req, res) => {
  console.log('Current user check - Session ID:', req.sessionID);
  console.log('Is authenticated:', req.isAuthenticated());
  console.log('User in session:', req.user?.email);
  
  if (req.isAuthenticated() && req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

module.exports = router; 