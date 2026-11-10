// Strip claim information from a list payload when the viewer owns the list,
// so owners never see who (or whether anyone) claimed a gift. Non-owners get
// the payload back untouched. The input is never mutated.
//
// Accepts the getList shape ({ list, items, isShared }) or a bare list object
// with `items`. The owner is read from list.user (id or populated) or
// list.owner.

// Deep copy that turns mongoose docs into plain objects and keeps ObjectIds
// and Dates intact.
function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value.toHexString === 'function') return value; // ObjectId
  if (typeof value.toObject === 'function') return clone(value.toObject());
  if (Array.isArray(value)) return value.map(clone);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = clone(v);
  return out;
}

const DERIVED_CLAIM_FIELDS = ['isClaimed', 'isAnonymousClaim', 'claimedCount', 'claimedQuantity', 'claimedSum'];

// Strip claim data from a single item. Exported for owner-only item
// responses (create/update) where there is no list payload to pass in.
function stripItem(item) {
  if (!item || typeof item !== 'object') return item;
  const out = { ...item };
  out.status = {};
  out.claims = [];
  for (const f of DERIVED_CLAIM_FIELDS) delete out[f];
  return out;
}

function idOf(ref) {
  if (!ref) return null;
  return (ref._id || ref).toString();
}

function sanitizeForOwner(listPayload, viewerId) {
  if (!listPayload || !viewerId) return listPayload;
  const list = listPayload.list || listPayload;
  const ownerId = idOf(list.user) || idOf(list.owner);
  if (!ownerId || ownerId !== viewerId.toString()) return listPayload;

  const out = clone(listPayload);
  if (Array.isArray(out.items)) out.items = out.items.map(stripItem);
  if (out.list && Array.isArray(out.list.items)) out.list.items = out.list.items.map(stripItem);
  return out;
}

module.exports = { sanitizeForOwner, stripItemClaims: stripItem };
