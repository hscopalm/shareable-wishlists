const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const { isMultiMode, isCashItem, getRequestedQty, getMyClaim, normalizeItem } = require('../utils/itemClaims');

// GET /api/public/invite/:token - View list via invite link (no auth required)
router.get('/invite/:token', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      inviteToken: req.params.token,
      inviteLinkEnabled: true
    })
      .populate('user', 'name picture')
      .populate('items.status.claimedBy', 'name picture')
      .populate('items.claims.claimedBy', 'name picture');

    if (!wishlist) {
      return res.status(404).json({ message: 'Invite link not found or disabled' });
    }

    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    const currentUserId = isAuthenticated ? req.user._id.toString() : null;
    const isOwner = currentUserId && wishlist.user._id.toString() === currentUserId;
    const isSharedWith = currentUserId && wishlist.sharedWith.some(
      id => id.toString() === currentUserId
    );

    // Build a privacy-safe response. Both single- and multi-claim items end up
    // in the same wire shape — a `claims: [...]` array — so the public
    // frontend can use the same display logic as the authed shared view.
    // Authed claimers expose name+picture; anonymous claimers expose only the
    // name they typed.
    const items = wishlist.items.map(item => {
      const normalized = normalizeItem(item);
      const claims = (normalized.claims || []).map(c => {
        if (c.isAnonymousClaim) {
          return {
            ...c,
            claimedBy: { _id: `anon-${item._id}-${c._id || ''}`, name: c.anonymousClaimerName, picture: null }
          };
        }
        if (c.claimedBy && c.claimedBy._id) {
          return {
            ...c,
            claimedBy: { _id: c.claimedBy._id, name: c.claimedBy.name, picture: c.claimedBy.picture }
          };
        }
        return c;
      });

      // Keep legacy status shape projected for the first claim too, so any
      // unmigrated UI bits that still read item.status.claimedBy keep working.
      const firstClaim = claims[0];
      const status = firstClaim
        ? { claimedBy: firstClaim.claimedBy, claimedAt: firstClaim.claimedAt }
        : {};
      const isAnon = !!(firstClaim && firstClaim.isAnonymousClaim);

      return {
        _id: item._id,
        type: item.type || 'gift',
        title: item.title,
        description: item.description,
        link: item.link,
        imageUrl: item.imageUrl,
        notes: item.notes,
        price: item.price,
        priority: item.priority,
        quantity: item.quantity,
        paymentLinks: normalized.paymentLinks,
        paymentUrls: normalized.paymentUrls,
        claims,
        status,
        isClaimed: claims.length > 0,
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

    if (wishlist.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You own this list' });
    }

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

// Build the shared public response shape for a single item after a claim
// update. Mirrors the GET handler's item projection so the client gets the
// same fields it can render with.
function projectPublicItem(item) {
  const normalized = normalizeItem(item);
  const claims = (normalized.claims || []).map(c => {
    if (c.isAnonymousClaim) {
      return {
        ...c,
        claimedBy: { _id: `anon-${item._id}-${c._id || ''}`, name: c.anonymousClaimerName, picture: null }
      };
    }
    if (c.claimedBy && c.claimedBy._id) {
      return {
        ...c,
        claimedBy: { _id: c.claimedBy._id, name: c.claimedBy.name, picture: c.claimedBy.picture }
      };
    }
    return c;
  });
  const firstClaim = claims[0];
  const status = firstClaim
    ? { claimedBy: firstClaim.claimedBy, claimedAt: firstClaim.claimedAt }
    : {};
  return {
    _id: item._id,
    type: item.type || 'gift',
    title: item.title,
    quantity: item.quantity,
    paymentLinks: normalized.paymentLinks,
    paymentUrls: normalized.paymentUrls,
    claims,
    status,
    isClaimed: claims.length > 0,
    isAnonymousClaim: !!(firstClaim && firstClaim.isAnonymousClaim)
  };
}

// POST /api/public/invite/:token/claim/:itemId - Claim/unclaim item via invite link.
//
// Behavior matrix:
//   - Single-mode + authed: legacy toggle (claim if free, unclaim if mine)
//   - Single-mode + anon (with allowAnonymousClaims): one-shot, irreversible
//   - Multi-mode + authed: upsert with capacity check (same as sharing.js multi)
//   - Multi-mode + anon: append a new anonymous claim with quantity (irreversible)
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
    const rawQty = req.body?.quantity;
    const hasQty = rawQty !== undefined && rawQty !== null && rawQty !== '';
    const reqQty = hasQty ? Number(rawQty) : null;
    if (hasQty && (!Number.isFinite(reqQty) || !Number.isInteger(reqQty) || reqQty < 0)) {
      return res.status(400).json({ message: 'Quantity must be a non-negative integer' });
    }

    if (isAuthenticated) {
      const userId = req.user._id;
      if (wishlist.user.toString() === userId.toString()) {
        return res.status(400).json({ message: 'Cannot claim items on your own list' });
      }

      if (isCashItem(item)) {
        const out = await doAuthedCashClaim({ wishlist, item, itemId, userId, token, reqQty, hasQty });
        if (out.error) return res.status(out.status).json({ message: out.error });
        return res.json(projectPublicItem(out.updated));
      }

      if (isMultiMode(item)) {
        const out = await doAuthedMultiClaim({ wishlist, item, itemId, userId, token, reqQty });
        if (out.error) return res.status(out.status).json({ message: out.error });
        return res.json(projectPublicItem(out.updated));
      }

      // Single-mode authed flow (legacy toggle, with optional explicit qty)
      if (hasQty && reqQty > 1) {
        return res.status(400).json({ message: 'This item only allows a single claim' });
      }
      const out = await doAuthedSingleClaim({ wishlist, itemId, userId, token, reqQty, hasQty, currentItem: item });
      if (out.error) return res.status(out.status).json({ message: out.error });
      return res.json(projectPublicItem(out.updated));
    }

    // Anonymous flow — requires opt-in on the list
    if (!wishlist.allowAnonymousClaims) {
      return res.status(401).json({ message: 'Sign in to claim items' });
    }
    const claimerName = typeof req.body?.claimerName === 'string' ? req.body.claimerName.trim() : '';
    if (!claimerName) {
      return res.status(400).json({ message: 'Name is required for anonymous claims' });
    }

    if (isCashItem(item)) {
      const out = await doAnonCashClaim({ wishlist, itemId, token, claimerName });
      if (out.error) return res.status(out.status).json({ message: out.error });
      return res.json(projectPublicItem(out.updated));
    }

    if (isMultiMode(item)) {
      const desired = reqQty === null || reqQty === 0 ? 1 : reqQty;
      const out = await doAnonMultiClaim({ wishlist, item, itemId, token, claimerName, desired });
      if (out.error) return res.status(out.status).json({ message: out.error });
      return res.json(projectPublicItem(out.updated));
    }

    const out = await doAnonSingleClaim({ wishlist, itemId, token, claimerName });
    if (out.error) return res.status(out.status).json({ message: out.error });
    return res.json(projectPublicItem(out.updated));
  } catch (error) {
    console.error('Error claiming item:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

async function doAuthedSingleClaim({ wishlist, itemId, userId, token, reqQty, hasQty, currentItem }) {
  const isMine = currentItem.status?.claimedBy?.toString() === userId.toString();
  let intent;
  if (hasQty) {
    intent = reqQty === 0 ? 'unclaim' : 'claim';
  } else {
    intent = isMine ? 'unclaim' : 'claim';
  }

  // arrayFilters with $[<id>] — see sharing.js for why $elemMatch + positional
  // doesn't work for the complex unclaimed-state filter.
  let result;
  if (intent === 'unclaim') {
    result = await Wishlist.findOneAndUpdate(
      { _id: wishlist._id, inviteToken: token, inviteLinkEnabled: true, 'items._id': itemId },
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
    if (!result && !isMine) {
      // Idempotent no-op — return the current state instead of 400
      result = await Wishlist.findById(wishlist._id);
    }
  } else {
    result = await Wishlist.findOneAndUpdate(
      { _id: wishlist._id, inviteToken: token, inviteLinkEnabled: true, 'items._id': itemId },
      {
        $set: {
          'items.$[it].status.claimedBy': userId,
          'items.$[it].status.claimedAt': new Date()
        },
        $addToSet: { sharedWith: userId }
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
    if (result) {
      const after = result.items.id(itemId);
      if (!after?.status?.claimedBy || after.status.claimedBy.toString() !== userId.toString()) {
        return { error: 'Item already claimed by someone else', status: 400 };
      }
    }
  }

  if (!result) {
    return { error: 'Item already claimed by someone else', status: 400 };
  }
  const populated = await Wishlist.findById(wishlist._id)
    .populate('items.status.claimedBy', 'name picture')
    .populate('items.claims.claimedBy', 'name picture');
  return { updated: populated.items.id(itemId) };
}

async function doAnonSingleClaim({ wishlist, itemId, token, claimerName }) {
  const result = await Wishlist.findOneAndUpdate(
    {
      _id: wishlist._id,
      inviteToken: token,
      inviteLinkEnabled: true,
      allowAnonymousClaims: true,
      'items._id': itemId
    },
    {
      $set: {
        'items.$[it].status.anonymousClaimerName': claimerName,
        'items.$[it].status.isAnonymousClaim': true,
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
  if (!result) {
    return { error: 'Item already claimed', status: 400 };
  }
  const after = result.items.id(itemId);
  if (!after?.status?.isAnonymousClaim || after.status.anonymousClaimerName !== claimerName) {
    return { error: 'Item already claimed', status: 400 };
  }
  const populated = await Wishlist.findById(wishlist._id)
    .populate('items.status.claimedBy', 'name picture')
    .populate('items.claims.claimedBy', 'name picture');
  return { updated: populated.items.id(itemId) };
}

// Multi-mode authed flow — see sharing.js handleMultiClaim for the design
// commentary. This variant also $addToSet's the user into sharedWith so a
// successful claim implicitly accepts the invite.
async function doAuthedMultiClaim({ wishlist, item, itemId, userId, token, reqQty }) {
  const desired = reqQty === null ? 1 : reqQty;
  const requestedQty = getRequestedQty(item);

  if (desired > 0) {
    const othersSum = (item.claims || [])
      .filter(c => !c.claimedBy || c.claimedBy.toString() !== userId.toString())
      .reduce((s, c) => s + (c.quantity || 1), 0);
    if (othersSum + desired > requestedQty) {
      return { error: `Only ${requestedQty - othersSum} remaining of ${requestedQty}`, status: 400 };
    }
  }

  const itemObjId = new mongoose.Types.ObjectId(itemId);
  const userObjId = new mongoose.Types.ObjectId(userId);
  const newClaim = { claimedBy: userObjId, claimedAt: new Date(), quantity: desired, isAnonymousClaim: false };

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
                              { $ifNull: ['$$item.claims', []] }
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
  }, {
    $set: {
      sharedWith: {
        $cond: [
          { $in: [userObjId, { $ifNull: ['$sharedWith', []] }] },
          '$sharedWith',
          { $concatArrays: [{ $ifNull: ['$sharedWith', []] }, [userObjId]] }
        ]
      }
    }
  }];

  await Wishlist.findOneAndUpdate(
    { _id: wishlist._id, inviteToken: token, inviteLinkEnabled: true, 'items._id': itemObjId },
    pipeline
  );

  const populated = await Wishlist.findById(wishlist._id)
    .populate('items.status.claimedBy', 'name picture')
    .populate('items.claims.claimedBy', 'name picture');
  const updated = populated.items.id(itemId);
  const myClaim = getMyClaim(updated, userId);
  if (desired > 0) {
    if (!myClaim || (myClaim.quantity || 1) !== desired) {
      return { error: 'Capacity exceeded; another claim landed first', status: 400 };
    }
  } else if (myClaim) {
    return { error: 'Unclaim failed; try again', status: 400 };
  }
  return { updated };
}

// Anonymous multi-mode flow. Anonymous claims can't be edited or removed
// later (caller has no identity), so we just append a new claim entry to
// claims[]. Capacity check is enforced atomically.
async function doAnonMultiClaim({ wishlist, item, itemId, token, claimerName, desired }) {
  const requestedQty = getRequestedQty(item);
  const othersSum = (item.claims || []).reduce((s, c) => s + (c.quantity || 1), 0);
  if (othersSum + desired > requestedQty) {
    return { error: `Only ${requestedQty - othersSum} remaining of ${requestedQty}`, status: 400 };
  }

  const itemObjId = new mongoose.Types.ObjectId(itemId);
  const newClaim = {
    claimedAt: new Date(),
    quantity: desired,
    isAnonymousClaim: true,
    anonymousClaimerName: claimerName
  };

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
                    $cond: [
                      { $lte: [
                        { $add: [
                          { $ifNull: [{ $sum: { $ifNull: ['$$item.claims.quantity', []] } }, 0] },
                          desired
                        ]},
                        { $ifNull: ['$$item.quantity', 1] }
                      ]},
                      { $concatArrays: [{ $ifNull: ['$$item.claims', []] }, [newClaim]] },
                      { $ifNull: ['$$item.claims', []] }
                    ]
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
    {
      _id: wishlist._id,
      inviteToken: token,
      inviteLinkEnabled: true,
      allowAnonymousClaims: true,
      'items._id': itemObjId
    },
    pipeline
  );

  const populated = await Wishlist.findById(wishlist._id)
    .populate('items.status.claimedBy', 'name picture')
    .populate('items.claims.claimedBy', 'name picture');
  const updated = populated.items.id(itemId);

  // Verify the new claim actually landed (capacity could have been eaten
  // by a concurrent write between our pre-check and the pipeline).
  const claimedSum = (updated.claims || []).reduce((s, c) => s + (c.quantity || 1), 0);
  if (claimedSum < othersSum + desired) {
    return { error: 'Capacity exceeded; another claim landed first', status: 400 };
  }
  return { updated };
}

// Cash claim via invite link, authed. Toggle: add my entry if missing,
// remove if present. Cash items don't enforce a quantity ceiling.
async function doAuthedCashClaim({ wishlist, item, itemId, userId, token, reqQty, hasQty }) {
  const claims = item.claims || [];
  const mine = claims.find(c => !c.isAnonymousClaim && c.claimedBy && c.claimedBy.toString() === userId.toString());

  let intent;
  if (hasQty) {
    intent = reqQty === 0 ? 'unclaim' : 'claim';
  } else {
    intent = mine ? 'unclaim' : 'claim';
  }

  if (intent === 'unclaim') {
    if (mine) {
      await Wishlist.findOneAndUpdate(
        { _id: wishlist._id, inviteToken: token, inviteLinkEnabled: true, 'items._id': itemId },
        { $pull: { 'items.$[it].claims': { claimedBy: userId } } },
        { arrayFilters: [{ 'it._id': itemId }] }
      );
    }
  } else if (!mine) {
    await Wishlist.findOneAndUpdate(
      { _id: wishlist._id, inviteToken: token, inviteLinkEnabled: true, 'items._id': itemId },
      {
        $push: {
          'items.$[it].claims': {
            claimedBy: userId,
            claimedAt: new Date(),
            quantity: 1,
            isAnonymousClaim: false
          }
        },
        $addToSet: { sharedWith: userId }
      },
      {
        arrayFilters: [{
          $and: [
            { 'it._id': itemId },
            { 'it.claims.claimedBy': { $ne: userId } }
          ]
        }]
      }
    );
  }

  const populated = await Wishlist.findById(wishlist._id)
    .populate('items.status.claimedBy', 'name picture')
    .populate('items.claims.claimedBy', 'name picture');
  return { updated: populated.items.id(itemId) };
}

// Anonymous cash claim via invite link. Always append a new entry; anonymous
// claims have no identity so they cannot be unclaimed.
async function doAnonCashClaim({ wishlist, itemId, token, claimerName }) {
  await Wishlist.findOneAndUpdate(
    {
      _id: wishlist._id,
      inviteToken: token,
      inviteLinkEnabled: true,
      allowAnonymousClaims: true,
      'items._id': itemId
    },
    {
      $push: {
        'items.$[it].claims': {
          claimedAt: new Date(),
          quantity: 1,
          isAnonymousClaim: true,
          anonymousClaimerName: claimerName
        }
      }
    },
    { arrayFilters: [{ 'it._id': itemId }] }
  );

  const populated = await Wishlist.findById(wishlist._id)
    .populate('items.status.claimedBy', 'name picture')
    .populate('items.claims.claimedBy', 'name picture');
  return { updated: populated.items.id(itemId) };
}

module.exports = router;
