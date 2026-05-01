const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');

// GET /api/public/invite/:token - View list via invite link (no auth required)
router.get('/invite/:token', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      inviteToken: req.params.token,
      inviteLinkEnabled: true
    })
      .populate('user', 'name picture')
      .populate('items.status.claimedBy', 'name picture');

    if (!wishlist) {
      return res.status(404).json({ message: 'Invite link not found or disabled' });
    }

    // Check if the current user (if authenticated) is already in sharedWith
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    const currentUserId = isAuthenticated ? req.user._id.toString() : null;
    const isOwner = currentUserId && wishlist.user._id.toString() === currentUserId;
    const isSharedWith = currentUserId && wishlist.sharedWith.some(
      id => id.toString() === currentUserId
    );

    // Build a privacy-safe response. Shape items like the authed shared view
    // (status.claimedBy populated) so the frontend can reuse WishlistItem.
    // Hide identity of authed claimers — anonymous claimers expose their typed name.
    const items = wishlist.items.map(item => {
      const isAnon = !!item.status?.isAnonymousClaim;
      const hasAuthedClaim = !!item.status?.claimedBy;
      const isClaimed = isAnon || hasAuthedClaim;

      let claimedBy = null;
      if (isAnon) {
        claimedBy = { _id: `anon-${item._id}`, name: item.status.anonymousClaimerName, picture: null };
      } else if (hasAuthedClaim) {
        claimedBy = {
          _id: item.status.claimedBy._id,
          name: item.status.claimedBy.name,
          picture: item.status.claimedBy.picture
        };
      }

      return {
        _id: item._id,
        title: item.title,
        description: item.description,
        link: item.link,
        imageUrl: item.imageUrl,
        notes: item.notes,
        price: item.price,
        priority: item.priority,
        status: claimedBy ? { claimedBy, claimedAt: item.status?.claimedAt } : {},
        isClaimed,
        isAnonymousClaim: isAnon
      };
    });

    res.json({
      list: {
        _id: wishlist._id,
        name: wishlist.name,
        description: wishlist.description,
        event_date: wishlist.event_date,
        mailingAddress: wishlist.mailingAddress,
        owner: {
          name: wishlist.user.name,
          picture: wishlist.user.picture
        },
        allowAnonymousClaims: wishlist.allowAnonymousClaims
      },
      items,
      viewer: {
        isAuthenticated,
        isOwner,
        isSharedWith
      }
    });
  } catch (error) {
    console.error('Error fetching public list:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/public/invite/:token/join - Join list via invite link (auth required)
router.post('/invite/:token/join', async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: 'Sign in to join this list' });
    }

    const wishlist = await Wishlist.findOne({
      inviteToken: req.params.token,
      inviteLinkEnabled: true
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'Invite link not found or disabled' });
    }

    // Don't let the owner join their own list
    if (wishlist.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You own this list' });
    }

    // Check if already in sharedWith
    const alreadyShared = wishlist.sharedWith.some(
      id => id.toString() === req.user._id.toString()
    );

    if (!alreadyShared) {
      wishlist.sharedWith.push(req.user._id);
      await wishlist.save();
    }

    res.json({ message: 'Successfully joined list', listId: wishlist._id });
  } catch (error) {
    console.error('Error joining list:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/public/invite/:token/claim/:itemId - Claim item via invite link.
// Atomic write so two simultaneous claims via the public link can't both win.
router.post('/invite/:token/claim/:itemId', async (req, res) => {
  try {
    const { token, itemId } = req.params;
    const wishlist = await Wishlist.findOne({ inviteToken: token, inviteLinkEnabled: true });
    if (!wishlist) {
      return res.status(404).json({ message: 'Invite link not found or disabled' });
    }

    const item = wishlist.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();

    // Filter that matches only when the item is still claimable (or is the
    // caller's own active claim, for the toggle-off case).
    const unclaimedFilter = {
      $and: [
        { $or: [{ 'status.claimedBy': { $exists: false } }, { 'status.claimedBy': null }] },
        { $or: [{ 'status.isAnonymousClaim': { $exists: false } }, { 'status.isAnonymousClaim': false }] }
      ]
    };

    if (isAuthenticated) {
      const userId = req.user._id;

      if (wishlist.user.toString() === userId.toString()) {
        return res.status(400).json({ message: 'Cannot claim items on your own list' });
      }

      const isMine = item.status?.claimedBy?.toString() === userId.toString();
      let result;

      if (isMine) {
        // Atomic unclaim — only succeeds if I'm still the claimer.
        result = await Wishlist.findOneAndUpdate(
          {
            _id: wishlist._id,
            inviteToken: token,
            inviteLinkEnabled: true,
            items: { $elemMatch: { _id: itemId, 'status.claimedBy': userId } }
          },
          { $set: { 'items.$.status': {} } },
          { new: true }
        );
      } else {
        // Atomic claim + auto-join.
        result = await Wishlist.findOneAndUpdate(
          {
            _id: wishlist._id,
            inviteToken: token,
            inviteLinkEnabled: true,
            items: { $elemMatch: { _id: itemId, ...unclaimedFilter } }
          },
          {
            $set: {
              'items.$.status.claimedBy': userId,
              'items.$.status.claimedAt': new Date()
            },
            $addToSet: { sharedWith: userId }
          },
          { new: true }
        );
      }

      if (!result) {
        return res.status(400).json({ message: 'Item already claimed by someone else' });
      }
    } else {
      // Anonymous flow
      if (!wishlist.allowAnonymousClaims) {
        return res.status(401).json({ message: 'Sign in to claim items' });
      }

      const claimerName = typeof req.body?.claimerName === 'string' ? req.body.claimerName.trim() : '';
      if (!claimerName) {
        return res.status(400).json({ message: 'Name is required for anonymous claims' });
      }

      const result = await Wishlist.findOneAndUpdate(
        {
          _id: wishlist._id,
          inviteToken: token,
          inviteLinkEnabled: true,
          allowAnonymousClaims: true,
          items: { $elemMatch: { _id: itemId, ...unclaimedFilter } }
        },
        {
          $set: {
            'items.$.status.anonymousClaimerName': claimerName,
            'items.$.status.isAnonymousClaim': true,
            'items.$.status.claimedAt': new Date()
          }
        },
        { new: true }
      );

      if (!result) {
        return res.status(400).json({ message: 'Item already claimed' });
      }
    }

    // Read the freshly-updated item back, populated, so the response shape
    // matches the GET handler.
    const populated = await Wishlist.findById(wishlist._id)
      .populate('items.status.claimedBy', 'name picture');
    const updated = populated.items.id(itemId);
    const isAnon = !!updated.status?.isAnonymousClaim;
    const hasAuthedClaim = !!updated.status?.claimedBy;
    const isClaimed = isAnon || hasAuthedClaim;

    let claimedBy = null;
    if (isAnon) {
      claimedBy = { _id: `anon-${updated._id}`, name: updated.status.anonymousClaimerName, picture: null };
    } else if (hasAuthedClaim) {
      claimedBy = {
        _id: updated.status.claimedBy._id,
        name: updated.status.claimedBy.name,
        picture: updated.status.claimedBy.picture
      };
    }

    res.json({
      _id: updated._id,
      title: updated.title,
      status: claimedBy ? { claimedBy, claimedAt: updated.status?.claimedAt } : {},
      isClaimed,
      isAnonymousClaim: isAnon
    });
  } catch (error) {
    console.error('Error claiming item:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
