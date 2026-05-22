// Mirror of backend/utils/itemClaims.js. Items arrive from the API with a
// normalized `claims: [...]` array, but legacy code paths may still send
// `status.claimedBy`, so this util handles both. Multi-mode is implied by
// item.quantity > 1.

export function isMultiMode(item) {
  return !!(item && item.quantity && item.quantity > 1);
}

export function getRequestedQty(item) {
  return isMultiMode(item) ? item.quantity : 1;
}

export function getClaims(item) {
  if (!item) return [];
  if (Array.isArray(item.claims) && item.claims.length) return item.claims;
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

export function getClaimedSum(item) {
  return getClaims(item).reduce((s, c) => s + (Number(c.quantity) || 1), 0);
}

// Find the current user's claim. Skips anonymous claims.
export function getMyClaim(item, userId) {
  if (!userId) return null;
  return getClaims(item).find(c => {
    if (c.isAnonymousClaim) return false;
    const cb = c.claimedBy;
    if (!cb) return false;
    const id = cb._id || cb;
    return id === userId || id?.toString?.() === userId?.toString?.();
  }) || null;
}

// Returns remaining capacity available for me to claim, accounting for my own
// existing claim (so editing 2 → 5 on a quantity-4 item with no other claims
// gives remaining=4, not 2).
export function getRemainingForMe(item, userId) {
  const requested = getRequestedQty(item);
  const claims = getClaims(item);
  const otherSum = claims
    .filter(c => {
      if (c.isAnonymousClaim) return true;  // anon claims count against capacity
      const cb = c.claimedBy;
      const id = cb?._id || cb;
      return id?.toString?.() !== userId?.toString?.();
    })
    .reduce((s, c) => s + (Number(c.quantity) || 1), 0);
  return Math.max(0, requested - otherSum);
}

// True iff every requested unit is claimed.
export function isFullyClaimed(item) {
  return getClaimedSum(item) >= getRequestedQty(item) && getRequestedQty(item) > 0 && getClaims(item).length > 0;
}
