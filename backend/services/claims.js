const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const { isMultiMode, isCashItem, getRequestedQty, getMyClaim, normalizeItem } = require('../utils/itemClaims');
const { NotFoundError, ValidationError, ConflictError } = require('./errors');

// Claim/unclaim an item in a list shared with the user. Behavior splits by
// item mode:
//
//   - Single-claim items (quantity absent/1) keep the original atomic
//     findOneAndUpdate toggle: claim if free, unclaim if mine, conflict if
//     someone else already holds it.
//   - Multi-claim items (quantity > 1) accept `quantity` and treat the call
//     as an upsert. `quantity` 0 (or missing) removes my claim; any positive
//     value sets my claim to exactly that, provided
//     `sum(other claims) + quantity <= item.quantity`. Race-safety comes from
//     an aggregation-pipeline update that only mutates if the capacity check
//     passes; we detect a lost race by reading back the item and checking
//     that my claim landed at the requested quantity.
//
// Conflicts are thrown with HTTP status 400 to match the existing REST API.
async function claimItem({ userId, listId, itemId, quantity }) {
  // Fast existence/auth check.
  const list = await Wishlist.findOne(
    { _id: listId, sharedWith: userId },
    { 'items._id': 1, 'items.status': 1, 'items.claims': 1, 'items.quantity': 1, 'items.type': 1 }
  );
  if (!list) {
    throw new NotFoundError('List not found or not shared with you');
  }
  const existingItem = list.items.id(itemId);
  if (!existingItem) {
    throw new NotFoundError('Item not found');
  }

  const rawQty = quantity;
  const hasQty = rawQty !== undefined && rawQty !== null && rawQty !== '';
  const reqQty = hasQty ? Number(rawQty) : null;
  if (hasQty && (!Number.isFinite(reqQty) || !Number.isInteger(reqQty) || reqQty < 0)) {
    throw new ValidationError('Quantity must be a non-negative integer');
  }

  if (isCashItem(existingItem)) {
    return handleCashClaim({ listId, itemId, userId, existingItem, reqQty, hasQty });
  }

  if (isMultiMode(existingItem)) {
    return handleMultiClaim({ listId, itemId, userId, existingItem, reqQty });
  }

  // Single-mode item. quantity > 1 in the body doesn't make sense here.
  if (hasQty && reqQty > 1) {
    throw new ValidationError('This item only allows a single claim');
  }

  return handleSingleClaim({ listId, itemId, userId, existingItem, reqQty, hasQty });
}

// Cash item claim: append-only, one entry per user, no quantity ceiling.
// Default behavior is toggle (add if missing, remove if present). An explicit
// quantity === 0 unclaims; any other quantity is treated as "claim" since
// cash items don't track per-contribution amounts.
async function handleCashClaim({ listId, itemId, userId, existingItem, reqQty, hasQty }) {
  const claims = existingItem.claims || [];
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
        { _id: listId, sharedWith: userId, 'items._id': itemId },
        { $pull: { 'items.$[it].claims': { claimedBy: userId } } },
        { arrayFilters: [{ 'it._id': itemId }] }
      );
    }
  } else {
    // Idempotent: only add if I don't already have an entry. We pre-checked
    // `mine`; arrayFilters target the right item by _id and the extra
    // claimedBy $ne guard prevents duplicate entries if two concurrent taps
    // race past the pre-check.
    if (!mine) {
      await Wishlist.findOneAndUpdate(
        { _id: listId, sharedWith: userId, 'items._id': itemId },
        {
          $push: {
            'items.$[it].claims': {
              claimedBy: userId,
              claimedAt: new Date(),
              quantity: 1,
              isAnonymousClaim: false
            }
          }
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
  }

  const populated = await Wishlist.findById(listId)
    .populate('items.status.claimedBy', 'name email picture')
    .populate('items.claims.claimedBy', 'name email picture');
  return normalizeItem(populated.items.id(itemId));
}

async function handleSingleClaim({ listId, itemId, userId, existingItem, reqQty, hasQty }) {
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
        throw new ConflictError('Item already claimed by someone else', undefined, 400);
      }
    }
  }

  if (!updateResult) {
    throw new ConflictError('Item already claimed by someone else', undefined, 400);
  }

  const populated = await Wishlist.findById(listId)
    .populate('items.status.claimedBy', 'name email picture')
    .populate('items.claims.claimedBy', 'name email picture');
  return normalizeItem(populated.items.id(itemId));
}

async function handleMultiClaim({ listId, itemId, userId, existingItem, reqQty }) {
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
      throw new ConflictError(`Only ${requestedQty - othersSum} remaining of ${requestedQty}`, undefined, 400);
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
      throw new ConflictError('Capacity exceeded; another claim landed first', undefined, 400);
    }
  } else {
    if (myClaim) {
      throw new ConflictError('Unclaim failed; try again', undefined, 400);
    }
  }

  return normalizeItem(updated);
}


module.exports = { claimItem };
