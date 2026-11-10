const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const { isMultiMode, isCashItem, getRequestedQty, getMyClaim } = require('../utils/itemClaims');
const { projectPublicItem } = require('./publicProjection');
const { NotFoundError, ValidationError, UnauthorizedError, ConflictError } = require('./errors');

// Claim/unclaim an item via an invite link. `userId` is null for anonymous
// visitors. Returns the public projection of the updated item. Conflicts are
// thrown with HTTP status 400 to match the existing REST API.
//
// Behavior matrix:
//   - Single-mode + authed: legacy toggle (claim if free, unclaim if mine)
//   - Single-mode + anon (with allowAnonymousClaims): one-shot, irreversible
//   - Multi-mode + authed: upsert with capacity check (same as claims.js multi)
//   - Multi-mode + anon: append a new anonymous claim with quantity (irreversible)
async function claimViaInvite({ token, itemId, userId, quantity, claimerName: rawName }) {
  const wishlist = await Wishlist.findOne({ inviteToken: token, inviteLinkEnabled: true });
  if (!wishlist) {
    throw new NotFoundError('Invite link not found or disabled');
  }

  const item = wishlist.items.id(itemId);
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  const rawQty = quantity;
  const hasQty = rawQty !== undefined && rawQty !== null && rawQty !== '';
  const reqQty = hasQty ? Number(rawQty) : null;
  if (hasQty && (!Number.isFinite(reqQty) || !Number.isInteger(reqQty) || reqQty < 0)) {
    throw new ValidationError('Quantity must be a non-negative integer');
  }

  if (userId) {
    if (wishlist.user.toString() === userId.toString()) {
      throw new ValidationError('Cannot claim items on your own list');
    }

    if (isCashItem(item)) {
      const out = await doAuthedCashClaim({ wishlist, item, itemId, userId, token, reqQty, hasQty });
      return projectPublicItem(out.updated);
    }

    if (isMultiMode(item)) {
      const out = await doAuthedMultiClaim({ wishlist, item, itemId, userId, token, reqQty });
      return projectPublicItem(out.updated);
    }

    // Single-mode authed flow (legacy toggle, with optional explicit qty)
    if (hasQty && reqQty > 1) {
      throw new ValidationError('This item only allows a single claim');
    }
    const out = await doAuthedSingleClaim({ wishlist, itemId, userId, token, reqQty, hasQty, currentItem: item });
    return projectPublicItem(out.updated);
  }

  // Anonymous flow, requires opt-in on the list
  if (!wishlist.allowAnonymousClaims) {
    throw new UnauthorizedError('Sign in to claim items');
  }
  const claimerName = typeof rawName === 'string' ? rawName.trim() : '';
  if (!claimerName) {
    throw new ValidationError('Name is required for anonymous claims');
  }

  if (isCashItem(item)) {
    const out = await doAnonCashClaim({ wishlist, itemId, token, claimerName });
    return projectPublicItem(out.updated);
  }

  if (isMultiMode(item)) {
    const desired = reqQty === null || reqQty === 0 ? 1 : reqQty;
    const out = await doAnonMultiClaim({ wishlist, item, itemId, token, claimerName, desired });
    return projectPublicItem(out.updated);
  }

  const out = await doAnonSingleClaim({ wishlist, itemId, token, claimerName });
  return projectPublicItem(out.updated);
}

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
        throw new ConflictError('Item already claimed by someone else', undefined, 400);
      }
    }
  }

  if (!result) {
    throw new ConflictError('Item already claimed by someone else', undefined, 400);
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
    throw new ConflictError('Item already claimed', undefined, 400);
  }
  const after = result.items.id(itemId);
  if (!after?.status?.isAnonymousClaim || after.status.anonymousClaimerName !== claimerName) {
    throw new ConflictError('Item already claimed', undefined, 400);
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
      throw new ConflictError(`Only ${requestedQty - othersSum} remaining of ${requestedQty}`, undefined, 400);
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
      throw new ConflictError('Capacity exceeded; another claim landed first', undefined, 400);
    }
  } else if (myClaim) {
    throw new ConflictError('Unclaim failed; try again', undefined, 400);
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
    throw new ConflictError(`Only ${requestedQty - othersSum} remaining of ${requestedQty}`, undefined, 400);
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
    throw new ConflictError('Capacity exceeded; another claim landed first', undefined, 400);
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

module.exports = { claimViaInvite };
