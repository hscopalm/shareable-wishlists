const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const { sendEmail, getShareInviteEmail } = require('../utils/emailService');
const ActivityLog = require('../models/ActivityLog');
const { isMultiMode, getRequestedQty, getClaimedSum, getMyClaim, normalizeItem } = require('../utils/itemClaims');

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
    .populate('items.status.claimedBy', 'name email picture')
    .populate('items.claims.claimedBy', 'name email picture')
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
        items: list.items.map(normalizeItem),
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

// Claim/unclaim an item in a shared list. Behavior splits by item mode:
//
//   - Single-claim items (quantity absent/1) keep the original atomic
//     findOneAndUpdate toggle: claim if free, unclaim if mine, 400 if
//     someone else already holds it.
//   - Multi-claim items (quantity > 1) accept `{ quantity }` in the body
//     and treat the endpoint as an upsert. `quantity` 0 (or missing) removes
//     my claim; any positive value sets my claim to exactly that, provided
//     `sum(other claims) + quantity <= item.quantity`. Race-safety comes from
//     an aggregation-pipeline update that only mutates if the capacity check
//     passes — we detect a lost race by reading back the item and checking
//     that my claim landed at the requested quantity.
router.post('/share/claim/:listId/:itemId', async (req, res) => {
  try {
    const { listId, itemId } = req.params;
    const userId = req.user._id;

    // Fast existence/auth check.
    const list = await Wishlist.findOne(
      { _id: listId, sharedWith: userId },
      { 'items._id': 1, 'items.status': 1, 'items.claims': 1, 'items.quantity': 1 }
    );
    if (!list) {
      return res.status(404).json({ message: 'List not found or not shared with you' });
    }
    const existingItem = list.items.id(itemId);
    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const rawQty = req.body?.quantity;
    const hasQty = rawQty !== undefined && rawQty !== null && rawQty !== '';
    const reqQty = hasQty ? Number(rawQty) : null;
    if (hasQty && (!Number.isFinite(reqQty) || !Number.isInteger(reqQty) || reqQty < 0)) {
      return res.status(400).json({ message: 'Quantity must be a non-negative integer' });
    }

    if (isMultiMode(existingItem)) {
      return await handleMultiClaim({ res, listId, itemId, userId, existingItem, reqQty });
    }

    // Single-mode item. quantity > 1 in the body doesn't make sense here.
    if (hasQty && reqQty > 1) {
      return res.status(400).json({ message: 'This item only allows a single claim' });
    }

    return await handleSingleClaim({ res, listId, itemId, userId, existingItem, reqQty, hasQty });
  } catch (error) {
    console.error('Error claiming/unclaiming item:', error);
    res.status(500).json({ message: error.message });
  }
});

async function handleSingleClaim({ res, listId, itemId, userId, existingItem, reqQty, hasQty }) {
  const claimerId = existingItem.status?.claimedBy?.toString();
  const isMine = claimerId === userId.toString();

  // Determine intent: explicit quantity wins; otherwise fall back to the
  // legacy toggle (unclaim if mine, claim otherwise) for backwards compat
  // with clients that send no body.
  let intent;
  if (hasQty) {
    intent = reqQty === 0 ? 'unclaim' : 'claim';
  } else {
    intent = isMine ? 'unclaim' : 'claim';
  }

  // Use arrayFilters with $[<id>] instead of $elemMatch + positional $. With
  // $elemMatch containing $and/$or, the positional `$` binds to the wrong
  // array element (silently — matchedCount=1 but the target item isn't
  // modified). arrayFilters target the specific element by _id and apply the
  // claim-state condition there.
  // arrayFilters need a single top-level field on the identifier, so wrap
  // multiple conditions in $and.
  let updateResult;
  if (intent === 'unclaim') {
    updateResult = await Wishlist.findOneAndUpdate(
      { _id: listId, sharedWith: userId, 'items._id': itemId },
      { $set: { 'items.$[it].status': {} } },
      {
        arrayFilters: [{
          $and: [
            { 'it._id': itemId },
            { 'it.status.claimedBy': userId }
          ]
        }],
        new: true
      }
    );
    // Unclaim is idempotent from the caller's perspective: if I didn't have a
    // claim, that's still a no-op success rather than an error.
    if (!updateResult && !isMine) {
      updateResult = await Wishlist.findById(listId);
    }
  } else {
    updateResult = await Wishlist.findOneAndUpdate(
      { _id: listId, sharedWith: userId, 'items._id': itemId },
      {
        $set: {
          'items.$[it].status.claimedBy': userId,
          'items.$[it].status.claimedAt': new Date()
        }
      },
      {
        arrayFilters: [{
          $and: [
            { 'it._id': itemId },
            { $or: [{ 'it.status.claimedBy': { $exists: false } }, { 'it.status.claimedBy': null }] },
            { $or: [{ 'it.status.isAnonymousClaim': { $exists: false } }, { 'it.status.isAnonymousClaim': false }] }
          ]
        }],
        new: true
      }
    );
    // arrayFilters returns the doc even when no array element matched the
    // filter. Detect the no-op by reading back the item state.
    if (updateResult) {
      const after = updateResult.items.id(itemId);
      if (!after?.status?.claimedBy || after.status.claimedBy.toString() !== userId.toString()) {
        return res.status(400).json({ message: 'Item already claimed by someone else' });
      }
    }
  }

  if (!updateResult) {
    return res.status(400).json({ message: 'Item already claimed by someone else' });
  }

  const populated = await Wishlist.findById(listId)
    .populate('items.status.claimedBy', 'name email picture')
    .populate('items.claims.claimedBy', 'name email picture');
  return res.json(normalizeItem(populated.items.id(itemId)));
}

async function handleMultiClaim({ res, listId, itemId, userId, existingItem, reqQty }) {
  // Default to 1 if no quantity supplied. This makes the multi-claim endpoint
  // forgiving for one-quantity defaults from minimal clients.
  const desired = reqQty === null ? 1 : reqQty;
  const requestedQty = getRequestedQty(existingItem);

  // Cheap pre-check — surfaces the right 400 message instead of relying on the
  // pipeline being a no-op. Race-safety still comes from the pipeline filter.
  if (desired > 0) {
    const othersSum = (existingItem.claims || [])
      .filter(c => !c.claimedBy || c.claimedBy.toString() !== userId.toString())
      .reduce((s, c) => s + (c.quantity || 1), 0);
    if (othersSum + desired > requestedQty) {
      return res.status(400).json({
        message: `Only ${requestedQty - othersSum} remaining of ${requestedQty}`
      });
    }
  }

  const itemObjId = new mongoose.Types.ObjectId(itemId);
  const userObjId = new mongoose.Types.ObjectId(userId);
  const newClaim = {
    claimedBy: userObjId,
    claimedAt: new Date(),
    quantity: desired,
    isAnonymousClaim: false
  };

  // Aggregation pipeline update. The pipeline iterates items, and for the
  // target item builds a new claims[] consisting of "everyone except me" plus
  // (optionally) my new claim. Capacity check is inlined as a $cond so the
  // mutation only happens when the math works at write time.
  const pipeline = [{
    $set: {
      items: {
        $map: {
          input: '$items',
          as: 'item',
          in: {
            $cond: [
              { $eq: ['$$item._id', itemObjId] },
              {
                $mergeObjects: ['$$item', {
                  claims: {
                    $let: {
                      vars: {
                        others: {
                          $filter: {
                            input: { $ifNull: ['$$item.claims', []] },
                            as: 'c',
                            cond: {
                              $or: [
                                { $not: ['$$c.claimedBy'] },
                                { $ne: ['$$c.claimedBy', userObjId] }
                              ]
                            }
                          }
                        }
                      },
                      in: {
                        $cond: [
                          { $eq: [desired, 0] },
                          '$$others',
                          {
                            $cond: [
                              { $lte: [
                                { $add: [
                                  { $ifNull: [{ $sum: '$$others.quantity' }, 0] },
                                  desired
                                ]},
                                { $ifNull: ['$$item.quantity', 1] }
                              ]},
                              { $concatArrays: ['$$others', [newClaim]] },
                              { $ifNull: ['$$item.claims', []] }  // capacity exceeded → no change
                            ]
                          }
                        ]
                      }
                    }
                  }
                }]
              },
              '$$item'
            ]
          }
        }
      }
    }
  }];

  await Wishlist.findOneAndUpdate(
    { _id: listId, sharedWith: userId, 'items._id': itemObjId },
    pipeline
  );

  // Read back and verify the write succeeded. If two clients raced and the
  // other won, my claim quantity won't match what I asked for.
  const populated = await Wishlist.findById(listId)
    .populate('items.status.claimedBy', 'name email picture')
    .populate('items.claims.claimedBy', 'name email picture');
  const updated = populated.items.id(itemId);
  const myClaim = getMyClaim(updated, userId);

  if (desired > 0) {
    if (!myClaim || (myClaim.quantity || 1) !== desired) {
      return res.status(400).json({ message: 'Capacity exceeded; another claim landed first' });
    }
  } else {
    if (myClaim) {
      return res.status(400).json({ message: 'Unclaim failed; try again' });
    }
  }

  return res.json(normalizeItem(updated));
}

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