const express = require('express');
const passport = require('passport');
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

router.get('/google', (req, res, next) => {
  console.log('===== /api/auth/google route hit =====');
  console.log('Request URL:', req.url);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('Is already authenticated:', req.isAuthenticated());
  
  // If already authenticated, redirect to home instead of going through OAuth again
  if (req.isAuthenticated()) {
    console.log('User already authenticated, redirecting to /');
    return res.redirect('/');
  }
  
  console.log('About to call passport.authenticate...');
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: true
  })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/',
    session: true
  }),
  (req, res) => {
    console.log('===== OAuth callback successful =====');
    console.log('User:', req.user?.email);
    console.log('Session ID after auth:', req.sessionID);
    console.log('Session data:', JSON.stringify(req.session, null, 2));
    
    // Force session save before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Session save failed');
      }
      console.log('Session saved successfully');
      console.log('Redirecting to /');
      res.redirect('/');
    });
  }
);

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