const express = require('express');
const router = express.Router();
const invites = require('../services/invites');
const { claimViaInvite } = require('../services/publicClaims');
const { sendError } = require('./handle');

// The signed-in user's id, or null for anonymous visitors.
function viewerId(req) {
  return req.isAuthenticated && req.isAuthenticated() ? req.user._id : null;
}

// GET /api/public/invite/:token - View list via invite link (no auth required)
router.get('/invite/:token', async (req, res) => {
  try {
    res.json(await invites.viewInvite({ token: req.params.token, userId: viewerId(req) }));
  } catch (error) {
    sendError(res, error, { message: 'Server error', log: 'Error fetching public list:' });
  }
});

// POST /api/public/invite/:token/join - Join list via invite link (auth required)
router.post('/invite/:token/join', async (req, res) => {
  try {
    res.json(await invites.joinInvite({ token: req.params.token, userId: viewerId(req) }));
  } catch (error) {
    sendError(res, error, { message: 'Server error', log: 'Error joining list:' });
  }
});

// POST /api/public/invite/:token/claim/:itemId - Claim/unclaim item via invite link
router.post('/invite/:token/claim/:itemId', async (req, res) => {
  try {
    const item = await claimViaInvite({
      token: req.params.token,
      itemId: req.params.itemId,
      userId: viewerId(req),
      quantity: req.body?.quantity,
      claimerName: req.body?.claimerName
    });
    res.json(item);
  } catch (error) {
    sendError(res, error, { message: 'Server error', log: 'Error claiming item:' });
  }
});

module.exports = router;
