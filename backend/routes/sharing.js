const express = require('express');
const router = express.Router();
const sharing = require('../services/sharing');
const { claimItem } = require('../services/claims');
const invites = require('../services/invites');
const { sendError } = require('./handle');

// Share a list with a user
router.post('/share/:listId', async (req, res) => {
  try {
    res.json(await sharing.shareList({
      userId: req.user._id,
      listId: req.params.listId,
      email: req.body?.email
    }));
  } catch (error) {
    sendError(res, error);
  }
});

// Get shared users
router.get('/share/:listId/shared-with', async (req, res) => {
  try {
    res.json(await sharing.listSharedWith({ userId: req.user._id, listId: req.params.listId }));
  } catch (error) {
    sendError(res, error, { log: 'Error getting shared users:' });
  }
});

// Unshare
router.delete('/share/:listId/unshare/:userId', async (req, res) => {
  try {
    res.json(await sharing.unshareList({
      userId: req.user._id,
      listId: req.params.listId,
      targetUserId: req.params.userId
    }));
  } catch (error) {
    sendError(res, error);
  }
});

// Get lists shared with current user
router.get('/share/shared-with-me', async (req, res) => {
  try {
    res.json(await sharing.listSharedWithMe({ userId: req.user._id }));
  } catch (error) {
    sendError(res, error, { log: 'Error fetching shared lists:' });
  }
});

// Claim/unclaim an item in a shared list (single, multi and cash modes)
router.post('/share/claim/:listId/:itemId', async (req, res) => {
  try {
    res.json(await claimItem({
      userId: req.user._id,
      listId: req.params.listId,
      itemId: req.params.itemId,
      quantity: req.body?.quantity
    }));
  } catch (error) {
    sendError(res, error, { log: 'Error claiming/unclaiming item:' });
  }
});

// Get invite link status
router.get('/share/:listId/invite-link', async (req, res) => {
  try {
    res.json(await invites.getInviteLink({ userId: req.user._id, listId: req.params.listId }));
  } catch (error) {
    sendError(res, error, { log: 'Error getting invite link:' });
  }
});

// Generate or regenerate invite link
router.post('/share/:listId/invite-link', async (req, res) => {
  try {
    res.json(await invites.createInviteLink({ userId: req.user._id, listId: req.params.listId }));
  } catch (error) {
    sendError(res, error, { log: 'Error generating invite link:' });
  }
});

// Disable invite link
router.delete('/share/:listId/invite-link', async (req, res) => {
  try {
    res.json(await invites.disableInviteLink({ userId: req.user._id, listId: req.params.listId }));
  } catch (error) {
    sendError(res, error, { log: 'Error disabling invite link:' });
  }
});

// Toggle anonymous claims
router.put('/share/:listId/anonymous-claims', async (req, res) => {
  try {
    res.json(await invites.setAnonymousClaims({
      userId: req.user._id,
      listId: req.params.listId,
      allow: req.body.allow
    }));
  } catch (error) {
    sendError(res, error, { log: 'Error toggling anonymous claims:' });
  }
});

module.exports = router;
