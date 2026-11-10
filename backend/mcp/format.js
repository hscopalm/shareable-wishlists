// Output shaping for MCP tool results: plain JSON, string ids under `id`,
// no Mongo noise (__v, duplicate virtual id).

function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  const hasMongoId = '_id' in value;
  if (hasMongoId) out.id = String(value._id);
  for (const [k, v] of Object.entries(value)) {
    if (k === '_id' || k === '__v' || (hasMongoId && k === 'id')) continue;
    out[k] = clean(v);
  }
  return out;
}

function toPlain(value) {
  if (value === undefined) return undefined;
  return clean(JSON.parse(JSON.stringify(value)));
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  }
  return out;
}

function personRef(ref) {
  if (!ref || typeof ref !== 'object') return undefined;
  return pick(ref, ['id', 'name', 'email']);
}

const ITEM_FIELDS = [
  'id', 'type', 'title', 'description', 'link', 'imageUrl', 'notes', 'price',
  'priority', 'quantity', 'paymentLinks', 'paymentUrls', 'createdAt'
];

// Format an item for a viewer. Claim details are only included when
// `includeClaims` is true, which callers must only pass for non-owners.
// Owner payloads should also have been through sanitizeForOwner first.
function formatItem(item, { viewerId, includeClaims }) {
  const p = toPlain(item);
  const out = pick(p, ITEM_FIELDS);
  if (!out.type) out.type = 'gift';
  if (!includeClaims) return out;

  const claims = (p.claims || []).map(c => {
    const claimerId = c.claimedBy && typeof c.claimedBy === 'object' ? c.claimedBy.id : c.claimedBy;
    return {
      by: c.isAnonymousClaim
        ? (c.anonymousClaimerName || 'Anonymous')
        : ((c.claimedBy && c.claimedBy.name) || 'Someone'),
      byMe: !c.isAnonymousClaim && Boolean(claimerId) && String(claimerId) === String(viewerId),
      quantity: c.quantity || 1,
      claimedAt: c.claimedAt
    };
  });
  const claimedQuantity = claims.reduce((s, c) => s + c.quantity, 0);
  out.claims = claims;
  out.claimedQuantity = claimedQuantity;
  out.claimedByMe = claims.some(c => c.byMe);
  if (out.type !== 'cash') {
    out.fullyClaimed = claimedQuantity >= (out.quantity > 1 ? out.quantity : 1);
  }
  return out;
}

module.exports = { toPlain, pick, personRef, formatItem };
