const mongoose = require('mongoose');
const { sanitizeForOwner } = require('../../../services/sanitize');

const ownerId = new mongoose.Types.ObjectId();
const bobId = new mongoose.Types.ObjectId();

function payload() {
  const single = {
    _id: new mongoose.Types.ObjectId(), title: 'Book',
    status: { claimedBy: { _id: bobId, name: 'Bob' }, claimedAt: new Date() },
    claims: [{ claimedBy: { _id: bobId, name: 'Bob' }, claimedAt: new Date(), quantity: 1 }]
  };
  const multi = {
    _id: new mongoose.Types.ObjectId(), title: 'Socks', quantity: 4, status: {},
    claims: [
      { claimedBy: { _id: bobId, name: 'Bob' }, quantity: 2 },
      { isAnonymousClaim: true, anonymousClaimerName: 'Gran', quantity: 1 }
    ]
  };
  const cash = {
    _id: new mongoose.Types.ObjectId(), type: 'cash', title: 'Cash', paymentLinks: { venmo: 'x' },
    paymentUrls: { venmo: 'https://venmo.com/x' }, status: {},
    claims: [{ claimedBy: { _id: bobId, name: 'Bob' }, quantity: 1 }]
  };
  const anon = {
    _id: new mongoose.Types.ObjectId(), title: 'Mug',
    status: { isAnonymousClaim: true, anonymousClaimerName: 'Gran', claimedAt: new Date() },
    claims: [{ isAnonymousClaim: true, anonymousClaimerName: 'Gran', quantity: 1 }],
    isClaimed: true, isAnonymousClaim: true
  };
  const items = [single, multi, cash, anon];
  return { list: { _id: new mongoose.Types.ObjectId(), user: { _id: ownerId, name: 'Owner' }, items }, items, isShared: false };
}

describe('sanitizeForOwner', () => {
  it('strips claim identity and status from every item shape for the owner', () => {
    const out = sanitizeForOwner(payload(), ownerId);
    for (const list of [out.items, out.list.items]) {
      for (const item of list) {
        expect(item.claims).toEqual([]);
        expect(item.status).toEqual({});
        expect(item.isClaimed).toBeUndefined();
        expect(item.isAnonymousClaim).toBeUndefined();
      }
    }
    expect(JSON.stringify(out)).not.toMatch(/Bob|Gran/);
  });

  it('keeps non-claim fields (quantity, payment info, ids)', () => {
    const input = payload();
    const out = sanitizeForOwner(input, ownerId.toString());
    expect(out.items[1].quantity).toBe(4);
    expect(out.items[2].paymentUrls).toEqual({ venmo: 'https://venmo.com/x' });
    expect(out.items[0]._id).toBe(input.items[0]._id);
    expect(out.list.user.name).toBe('Owner');
  });

  it('returns the payload unchanged for a shared viewer', () => {
    const input = payload();
    const out = sanitizeForOwner(input, bobId);
    expect(out).toBe(input);
    expect(out.items[0].claims).toHaveLength(1);
  });

  it('does not mutate its input', () => {
    const input = payload();
    const before = JSON.stringify(input);
    sanitizeForOwner(input, ownerId);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('handles an unpopulated owner id and a bare list with items', () => {
    const bare = { user: ownerId, items: payload().items };
    const out = sanitizeForOwner(bare, ownerId);
    expect(out.items.every(i => i.claims.length === 0)).toBe(true);
    expect(bare.items[0].claims).toHaveLength(1);
  });

  it('returns lists with no owner info untouched', () => {
    const input = { items: payload().items };
    expect(sanitizeForOwner(input, ownerId)).toBe(input);
  });
});
