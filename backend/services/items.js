const Wishlist = require('../models/Wishlist');
const { getClaims, getClaimedSum, isMultiMode, isCashItem, normalizeItem } = require('../utils/itemClaims');
const { sanitizePaymentLinks, hasAnyHandle } = require('../utils/paymentLinks');
const { NotFoundError, ValidationError } = require('./errors');

// Coerce a quantity input to a positive integer or undefined.
// We never store quantity = 1; an absent/null field is the single-claim
// default and avoids a needless storage difference between "no quantity"
// and "quantity 1".
function parseQuantity(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null; // invalid sentinel
  return n > 1 ? n : undefined;
}

// Gift item fields the owner may set directly. Everything else on an item
// (_id, createdAt, status, claims) is server-controlled; type, quantity and
// paymentLinks have their own handling below.
const GIFT_FIELDS = ['title', 'description', 'link', 'imageUrl', 'notes', 'price', 'priority'];

function pickGiftFields(body) {
  const out = {};
  for (const key of GIFT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}

// `data` is the item body as sent by the client (title, description, link,
// imageUrl, notes, price, priority, quantity, type, paymentLinks).
async function createItem({ userId, listId, data }) {
  const { quantity: rawQty, type: rawType, paymentLinks: rawPaymentLinks } = data || {};
  const itemData = pickGiftFields(data || {});

  const wishlist = await Wishlist.findOne({ _id: listId, user: userId });
  if (!wishlist) {
    throw new NotFoundError('List not found');
  }

  const itemType = rawType === 'cash' ? 'cash' : 'gift';

  if (itemType === 'cash') {
    const { sanitized } = sanitizePaymentLinks(rawPaymentLinks);
    if (!hasAnyHandle(sanitized)) {
      throw new ValidationError('At least one payment handle is required');
    }
    wishlist.items.push({
      type: 'cash',
      title: itemData.title,
      description: itemData.description,
      notes: itemData.notes,
      paymentLinks: sanitized,
      createdAt: new Date()
    });
    await wishlist.save();
    return normalizeItem(wishlist.items[wishlist.items.length - 1]);
  }

  const quantity = parseQuantity(rawQty);
  if (quantity === null) {
    throw new ValidationError('Quantity must be a positive integer');
  }

  const newItem = {
    ...itemData,
    type: 'gift',
    createdAt: new Date()
  };
  if (quantity !== undefined) newItem.quantity = quantity;

  wishlist.items.push(newItem);
  await wishlist.save();
  return normalizeItem(wishlist.items[wishlist.items.length - 1]);
}

// Update item. Handles two side effects of changing the `quantity` field:
//   - Going from single (or undefined) to multi: migrate any existing
//     status.claimedBy into a one-element claims[] entry, clear status.
//   - Going from multi back to single (quantity <= 1 / absent): if exactly
//     one claim exists, collapse it back into status; if more than one,
//     leave claims[] alone and surface a warning so the owner notices.
//
// Cash items take a separate path: no quantity logic, payment-handle
// validation, type changes rejected.
async function updateItem({ userId, itemId, data }) {
  const body = data || {};
  const wishlist = await Wishlist.findOne({ 'items._id': itemId, user: userId });
  if (!wishlist) {
    throw new NotFoundError('Item not found');
  }

  const itemIndex = wishlist.items.findIndex(item => item._id.toString() === itemId);
  if (itemIndex === -1) {
    throw new NotFoundError('Item not found');
  }

  const existing = wishlist.items[itemIndex];
  const existingObj = existing.toObject();

  if (body.type && body.type !== existingObj.type) {
    throw new ValidationError('Item type cannot be changed');
  }

  if (isCashItem(existingObj)) {
    const { title, description, notes, paymentLinks: rawPaymentLinks } = body;
    const incoming = rawPaymentLinks !== undefined
      ? sanitizePaymentLinks(rawPaymentLinks).sanitized
      : existingObj.paymentLinks || {};
    if (!hasAnyHandle(incoming)) {
      throw new ValidationError('At least one payment handle is required');
    }
    const merged = { ...existingObj, paymentLinks: incoming };
    if (title !== undefined) merged.title = title;
    if (description !== undefined) merged.description = description;
    if (notes !== undefined) merged.notes = notes;
    wishlist.items.set(itemIndex, merged);
    await wishlist.save();
    return normalizeItem(wishlist.items[itemIndex]);
  }

  const { quantity: rawQty } = body;
  const rest = pickGiftFields(body);
  const hasQtyField = Object.prototype.hasOwnProperty.call(body, 'quantity');
  const newQty = hasQtyField ? parseQuantity(rawQty) : existingObj.quantity;
  if (hasQtyField && newQty === null) {
    throw new ValidationError('Quantity must be a positive integer');
  }

  const wasMulti = isMultiMode(existingObj);
  const willBeMulti = !!(newQty && newQty > 1);

  let warning = null;

  // Start from the merge of existing + incoming non-quantity fields, then
  // selectively rewrite quantity / claims / status to reflect the mode
  // transition. Working on a plain object avoids the subdoc-mutation
  // pitfalls Mongoose has around `undefined` assignment.
  const merged = { ...existingObj, ...rest };

  if (!wasMulti && willBeMulti) {
    // Single -> multi: migrate status.claimedBy (if any) into a single claim
    const legacyClaims = getClaims(existingObj);
    merged.claims = legacyClaims.map(c => ({
      claimedBy: c.claimedBy,
      claimedAt: c.claimedAt || new Date(),
      quantity: 1,
      anonymousClaimerName: c.anonymousClaimerName,
      isAnonymousClaim: !!c.isAnonymousClaim
    }));
    merged.status = {};
    merged.quantity = newQty;
  } else if (wasMulti && !willBeMulti) {
    // Multi -> single: collapse if possible
    const claims = existingObj.claims || [];
    if (claims.length <= 1) {
      const c = claims[0];
      merged.status = c ? {
        claimedBy: c.claimedBy,
        claimedAt: c.claimedAt,
        anonymousClaimerName: c.anonymousClaimerName,
        isAnonymousClaim: !!c.isAnonymousClaim
      } : {};
      merged.claims = [];
    } else {
      warning = `Quantity removed but ${claims.length} partial claims remain; clear them manually if needed.`;
      merged.claims = claims;
      merged.status = existingObj.status || {};
    }
    merged.quantity = undefined;
  } else if (wasMulti && willBeMulti) {
    // Multi -> multi: only warn if dropping below current claimed sum
    if (newQty < getClaimedSum(existingObj)) {
      warning = `New quantity (${newQty}) is below the current claimed total (${getClaimedSum(existingObj)}).`;
    }
    merged.claims = existingObj.claims || [];
    merged.status = existingObj.status || {};
    merged.quantity = newQty;
  } else {
    // Single -> single: keep status, no claims
    merged.claims = [];
    merged.status = existingObj.status || {};
    merged.quantity = undefined;
  }

  // Replace the subdoc. Setting items[i] with .set() makes Mongoose treat
  // the assignment as a real subdoc mutation and validate the new shape.
  wishlist.items.set(itemIndex, merged);

  await wishlist.save();
  const out = normalizeItem(wishlist.items[itemIndex]);
  if (warning) out.warning = warning;
  return out;
}

async function deleteItem({ userId, itemId }) {
  const wishlist = await Wishlist.findOne({ 'items._id': itemId, user: userId });
  if (!wishlist) {
    throw new NotFoundError('Item not found');
  }

  wishlist.items = wishlist.items.filter(item => item._id.toString() !== itemId);

  await wishlist.save();
  return { message: 'Item deleted' };
}

module.exports = { createItem, updateItem, deleteItem, parseQuantity };
