const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const { sendEmail, getShareInviteEmail } = require('../utils/emailService');
const ActivityLog = require('../models/ActivityLog');

// Basic RFC-5322-ish email validation. Catches obvious typos without
// pretending to be a real address verifier.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Share a list with a user
router.post('/share/:listId', async (req, res) => {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
      return res.status(400).json({ message: 'A valid email address is required' });
    }
    const email = rawEmail.toLowerCase();

    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    let userToShare = await User.findOne({ email });

    if (!userToShare) {
      // Create a placeholder user instead of a pending share
      userToShare = new User({
        email,
        isPending: true
      });
      await userToShare.save();
    }

    // Prevent sharing with self
    if (userToShare._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }

    // Check if already shared
    if (wishlist.sharedWith.includes(userToShare._id)) {
      return res.status(400).json({ message: 'List already shared with this user' });
    }

    // Add user to sharedWith array
    wishlist.sharedWith.push(userToShare._id);
    await wishlist.save();

    // Send email
    const inviteLink = `${process.env.FRONTEND_URL}/login`;
    const emailData = getShareInviteEmail({
      list: wishlist,
      senderName: req.user.name,
      email,
      inviteLink
    });
    await sendEmail(emailData);

    // Return user info with pending status
    res.json({
      id: userToShare._id,
      email: userToShare.email,
      isPending: userToShare.isPending,
      createdAt: userToShare.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get shared users
router.get('/share/:listId/shared-with', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    }).populate('sharedWith', 'name email picture isPending');

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Get the latest view time for each shared user
    const viewTimes = await ActivityLog.aggregate([
      {
        $match: {
          action: 'view_list',
          wishlist: wishlist._id,
          causer: { $in: wishlist.sharedWith.map(user => user._id) }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$causer',
          lastViewed: { $first: '$createdAt' }
        }
      }
    ]);

    // Create a map of user IDs to their last view time
    const viewTimeMap = viewTimes.reduce((acc, view) => {
      acc[view._id.toString()] = view.lastViewed;
      return acc;
    }, {});

    const sharedUsers = wishlist.sharedWith.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      isPending: user.isPending,
      lastViewed: viewTimeMap[user._id.toString()] || null
    }));

    res.json(sharedUsers);
  } catch (error) {
    console.error('Error getting shared users:', error);
    res.status(500).json({ message: error.message });
  }
});

// Unshare
router.delete('/share/:listId/unshare/:userId', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    wishlist.sharedWith = wishlist.sharedWith.filter(
      id => id.toString() !== req.params.userId
    );
    await wishlist.save();

    res.json({ message: 'Share removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get lists shared with current user
router.get('/share/shared-with-me', async (req, res) => {
  try {
    const sharedLists = await Wishlist.find({
      sharedWith: req.user._id
    })
    .populate('user', 'name email picture')
    .sort({ createdAt: -1 });

    // Filter out lists where the owner no longer exists and format the response
    const lists = sharedLists
      .filter(list => list.user) // Only include lists where the owner still exists
      .map(list => ({
        _id: list._id,
        name: list.name,
        description: list.description,
        event_date: list.event_date,
        owner: {
          _id: list.user._id,
          name: list.user.name,
          email: list.user.email,
          picture: list.user.picture
        },
        items: list.items,
        sharedAt: list.createdAt,
        isArchived: list.isArchived,
        archiveDate: list.archiveDate
      }));

    res.json(lists);
  } catch (error) {
    console.error('Error fetching shared lists:', error);
    res.status(500).json({ message: error.message });
  }
});

// Claim/unclaim an item in a shared list.
// Uses an atomic findOneAndUpdate so two simultaneous claims can't both win
// the race; the document filter requires the item to actually be unclaimed
// (or claimed by the caller, for unclaim) at the moment of the write.
router.post('/share/claim/:listId/:itemId', async (req, res) => {
  try {
    const { listId, itemId } = req.params;
    const userId = req.user._id;

    // Fast existence/auth check so we can return the right 404 vs 400.
    const list = await Wishlist.findOne({ _id: listId, sharedWith: userId }, { 'items._id': 1, 'items.status': 1 });
    if (!list) {
      return res.status(404).json({ message: 'List not found or not shared with you' });
    }
    const existingItem = list.items.id(itemId);
    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const claimerId = existingItem.status?.claimedBy?.toString();
    const isMine = claimerId === userId.toString();

    let updateResult;
    if (isMine) {
      // Atomic unclaim — only succeeds if I'm still the claimer.
      updateResult = await Wishlist.findOneAndUpdate(
        {
          _id: listId,
          sharedWith: userId,
          items: { $elemMatch: { _id: itemId, 'status.claimedBy': userId } }
        },
        { $set: { 'items.$.status': {} } },
        { new: true }
      );
    } else {
      // Atomic claim — only succeeds if no one has claimed yet.
      updateResult = await Wishlist.findOneAndUpdate(
        {
          _id: listId,
          sharedWith: userId,
          items: {
            $elemMatch: {
              _id: itemId,
              $and: [
                { $or: [{ 'status.claimedBy': { $exists: false } }, { 'status.claimedBy': null }] },
                { $or: [{ 'status.isAnonymousClaim': { $exists: false } }, { 'status.isAnonymousClaim': false }] }
              ]
            }
          }
        },
        {
          $set: {
            'items.$.status.claimedBy': userId,
            'items.$.status.claimedAt': new Date()
          }
        },
        { new: true }
      );
    }

    if (!updateResult) {
      return res.status(400).json({ message: 'Item already claimed by someone else' });
    }

    const populated = await Wishlist.findById(listId)
      .populate('items.status.claimedBy', 'name email picture');
    res.json(populated.items.id(itemId));
  } catch (error) {
    console.error('Error claiming/unclaiming item:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get invite link status
router.get('/share/:listId/invite-link', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
    res.json({
      enabled: wishlist.inviteLinkEnabled,
      token: wishlist.inviteToken || null,
      link: wishlist.inviteToken ? `${frontendUrl}/invite/${wishlist.inviteToken}` : null,
      allowAnonymousClaims: wishlist.allowAnonymousClaims
    });
  } catch (error) {
    console.error('Error getting invite link:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate or regenerate invite link
router.post('/share/:listId/invite-link', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    wishlist.inviteToken = crypto.randomBytes(32).toString('hex');
    wishlist.inviteLinkEnabled = true;
    await wishlist.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
    res.json({
      token: wishlist.inviteToken,
      link: `${frontendUrl}/invite/${wishlist.inviteToken}`
    });
  } catch (error) {
    console.error('Error generating invite link:', error);
    res.status(500).json({ message: error.message });
  }
});

// Disable invite link
router.delete('/share/:listId/invite-link', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    wishlist.inviteLinkEnabled = false;
    await wishlist.save();

    res.json({ message: 'Invite link disabled' });
  } catch (error) {
    console.error('Error disabling invite link:', error);
    res.status(500).json({ message: error.message });
  }
});

// Toggle anonymous claims
router.put('/share/:listId/anonymous-claims', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    wishlist.allowAnonymousClaims = !!req.body.allow;
    await wishlist.save();

    res.json({ allowAnonymousClaims: wishlist.allowAnonymousClaims });
  } catch (error) {
    console.error('Error toggling anonymous claims:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 