// Tolerant reader for wishlist item claims.
//
// Items live in two shapes for backwards compatibility:
//   - Legacy single-claim: { status: { claimedBy, claimedAt, isAnonymousClaim, ... } }
//   - Multi-claim: { quantity: N, claims: [ { claimedBy, quantity, ... } ] }
//
// An item is in "multi mode" iff quantity > 1. Otherwise it's "single mode"
// and uses the legacy status shape. Migration between modes happens lazily,
// inline with the writes that need the new shape (see backend/routes/wishlist.js
// PUT handler when quantity goes up or down).

function isMultiMode(item) {
  return !!(item && item.quantity && item.quantity > 1);
}

function getRequestedQty(item) {
  return isMultiMode(item) ? item.quantity : 1;
}

// Return a uniform [{ claimedBy, claimedAt, quantity, anonymousClaimerName, isAnonymousClaim }]
// regardless of which storage shape the item uses. Never throws; missing data
// becomes an empty array.
function getClaims(item) {
  if (!item) return [];
  if (isMultiMode(item)) {
    return Array.isArray(item.claims) ? item.claims : [];
  }
  const status = item.status;
  if (status && (status.claimedBy || status.isAnonymousClaim)) {
    return [{
      claimedBy: status.claimedBy,
      claimedAt: status.claimedAt,
      quantity: 1,
      anonymousClaimerName: status.anonymousClaimerName,
      isAnonymousClaim: !!status.isAnonymousClaim
    }];
  }
  return [];
}

function getClaimedSum(item) {
  return getClaims(item).reduce((s, c) => s + (Number(c.quantity) || 1), 0);
}

// Find the current user's claim entry (or null). Skips anonymous claims since
// they're not associated with a user account.
function getMyClaim(item, userId) {
  if (!userId) return null;
  const userIdStr = userId.toString();
  return getClaims(item).find(c => {
    if (c.isAnonymousClaim) return false;
    const cb = c.claimedBy;
    if (!cb) return false;
    const id = cb._id ? cb._id.toString() : cb.toString();
    return id === userIdStr;
  }) || null;
}

// Project an item subdocument into the wire shape the frontend expects:
//   - Always exposes a `claims: [...]` array (normalized via getClaims)
//   - Carries quantity through unchanged (undefined for single-mode items)
//   - Keeps `status` for compatibility with any code paths that haven't migrated yet
//
// Mongoose subdocs need toObject() first to get plain data we can re-shape.
function normalizeItem(item) {
  if (!item) return item;
  const plain = typeof item.toObject === 'function' ? item.toObject({ virtuals: true }) : { ...item };
  plain.claims = getClaims(item).map(c => {
    // c may be a subdoc; toObject it so populated refs come through
    if (c && typeof c.toObject === 'function') return c.toObject({ virtuals: true });
    return c;
  });
  return plain;
}

module.exports = {
  isMultiMode,
  getRequestedQty,
  getClaims,
  getClaimedSum,
  getMyClaim,
  normalizeItem,
};
