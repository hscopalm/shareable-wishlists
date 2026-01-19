const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

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
        console.log('Dev user not found');
        return res.redirect(`${process.env.FRONTEND_URL}/?error=dev_user_not_found`);
      }

      console.log('Found dev user:', devUser.email);

      req.login(devUser, (err) => {
        if (err) {
          console.log('Login error:', err);
          return res.redirect(`${process.env.FRONTEND_URL}/?error=login_failed`);
        }

        console.log('Login successful');
        console.log('req.user:', req.user);
        console.log('req.session.passport:', req.session.passport);
        console.log('req.isAuthenticated():', req.isAuthenticated());

        // Explicitly save session before redirect
        req.session.save((saveErr) => {
          if (saveErr) {
            console.log('Session save error:', saveErr);
            return res.redirect(`${process.env.FRONTEND_URL}/?error=session_save_failed`);
          }
          console.log('Session saved with passport:', req.session.passport);
          res.redirect(`${process.env.FRONTEND_URL}/`);
        });
      });
    } catch (error) {
      console.log('Dev login error:', error);
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
      res.redirect(`${process.env.FRONTEND_URL}/`);
    }
  );
}

router.get('/current-user', (req, res) => {
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