const { normalizeItem } = require('../utils/itemClaims');

// Privacy-safe claims for the public (invite link) wire shape. Both single-
// and multi-claim items end up as a `claims: [...]` array. Authed claimers
// expose name+picture; anonymous claimers expose only the name they typed.
function projectClaims(item, normalized) {
  return (normalized.claims || []).map(c => {
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
}

// Keep the legacy status shape projected for the first claim too, so any
// unmigrated UI bits that still read item.status.claimedBy keep working.
function projectStatus(claims) {
  const firstClaim = claims[0];
  return firstClaim
    ? { claimedBy: firstClaim.claimedBy, claimedAt: firstClaim.claimedAt }
    : {};
}

// Full item projection used by the public list view.
function projectPublicListItem(item) {
  const normalized = normalizeItem(item);
  const claims = projectClaims(item, normalized);
  const firstClaim = claims[0];
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
    status: projectStatus(claims),
    isClaimed: claims.length > 0,
    isAnonymousClaim: !!(firstClaim && firstClaim.isAnonymousClaim)
  };
}

// Smaller projection returned after a claim update.
function projectPublicItem(item) {
  const normalized = normalizeItem(item);
  const claims = projectClaims(item, normalized);
  const firstClaim = claims[0];
  return {
    _id: item._id,
    type: item.type || 'gift',
    title: item.title,
    quantity: item.quantity,
    paymentLinks: normalized.paymentLinks,
    paymentUrls: normalized.paymentUrls,
    claims,
    status: projectStatus(claims),
    isClaimed: claims.length > 0,
    isAnonymousClaim: !!(firstClaim && firstClaim.isAnonymousClaim)
  };
}

module.exports = { projectPublicListItem, projectPublicItem };
