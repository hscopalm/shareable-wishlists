const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/google', (req, res, next) => {
  console.log('Attempting Google authentication');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: process.env.NODE_ENV === 'production' 
      ? '/' 
      : 'http://localhost:3000/'
  }),
  (req, res) => {
    res.redirect(process.env.NODE_ENV === 'production' 
      ? '/' 
      : 'http://localhost:3000/');
  }
);

router.get('/current-user', (req, res) => {
  if (req.user) {
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
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router; 