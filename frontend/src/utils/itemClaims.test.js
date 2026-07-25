import {
  isCashItem,
  isMultiMode,
  getRequestedQty,
  getClaims,
  getClaimedSum,
  getMyClaim,
  getRemainingForMe,
  isFullyClaimed,
} from './itemClaims';

describe('isCashItem', () => {
  it('is true only for type: cash', () => {
    expect(isCashItem({ type: 'cash' })).toBe(true);
    expect(isCashItem({ type: 'gift' })).toBe(false);
    expect(isCashItem({})).toBe(false);
    expect(isCashItem(null)).toBe(false);
  });
});

describe('isMultiMode', () => {
  it('treats cash items as always multi-mode', () => {
    expect(isMultiMode({ type: 'cash' })).toBe(true);
  });

  it('is true only when quantity > 1', () => {
    expect(isMultiMode({ quantity: 1 })).toBe(false);
    expect(isMultiMode({ quantity: 5 })).toBe(true);
    expect(isMultiMode({})).toBe(false);
  });
});

describe('getRequestedQty', () => {
  it('is Infinity for cash items', () => {
    expect(getRequestedQty({ type: 'cash' })).toBe(Infinity);
  });

  it('defaults to 1 for single-mode gift items', () => {
    expect(getRequestedQty({ quantity: 1 })).toBe(1);
    expect(getRequestedQty({})).toBe(1);
  });

  it('uses the quantity field for multi-mode items', () => {
    expect(getRequestedQty({ quantity: 4 })).toBe(4);
  });
});

describe('getClaims', () => {
  it('returns an empty array for items with no claims', () => {
    expect(getClaims({})).toEqual([]);
    expect(getClaims(null)).toEqual([]);
  });

  it('prefers the normalized claims array when present', () => {
    const claims = [{ claimedBy: 'u1', quantity: 2 }];
    expect(getClaims({ claims })).toBe(claims);
  });

  it('falls back to legacy status.claimedBy, normalized to a one-item array', () => {
    const item = {
      status: { claimedBy: { _id: 'u1' }, claimedAt: '2024-01-01' },
    };
    expect(getClaims(item)).toEqual([
      { claimedBy: { _id: 'u1' }, claimedAt: '2024-01-01', quantity: 1, anonymousClaimerName: undefined, isAnonymousClaim: false },
    ]);
  });

  it('falls back to a legacy anonymous claim', () => {
    const item = {
      status: { isAnonymousClaim: true, anonymousClaimerName: 'Guest' },
    };
    const claims = getClaims(item);
    expect(claims).toHaveLength(1);
    expect(claims[0].isAnonymousClaim).toBe(true);
    expect(claims[0].anonymousClaimerName).toBe('Guest');
  });
});

describe('getClaimedSum', () => {
  it('sums claim quantities, defaulting missing quantity to 1', () => {
    expect(getClaimedSum({ claims: [{ quantity: 2 }, {}, { quantity: 3 }] })).toBe(6);
  });

  it('is 0 for unclaimed items', () => {
    expect(getClaimedSum({})).toBe(0);
  });
});

describe('getMyClaim', () => {
  const userId = 'user-123';

  it('returns null without a userId', () => {
    expect(getMyClaim({ claims: [{ claimedBy: { _id: userId } }] }, undefined)).toBeNull();
  });

  it('finds a claim by matching claimedBy._id', () => {
    const mine = { claimedBy: { _id: userId }, quantity: 2 };
    const item = { claims: [{ claimedBy: { _id: 'someone-else' } }, mine] };
    expect(getMyClaim(item, userId)).toBe(mine);
  });

  it('skips anonymous claims even if names collide', () => {
    const item = { claims: [{ isAnonymousClaim: true, claimedBy: { _id: userId } }] };
    expect(getMyClaim(item, userId)).toBeNull();
  });
});

describe('getRemainingForMe', () => {
  it('accounts for my own existing claim so raising it is not blocked by itself', () => {
    // quantity 4 item, I've already claimed 2, nobody else has claimed any
    const item = { quantity: 4, claims: [{ claimedBy: { _id: 'me' }, quantity: 2 }] };
    expect(getRemainingForMe(item, 'me')).toBe(4);
  });

  it('subtracts other users claims from capacity', () => {
    const item = {
      quantity: 4,
      claims: [{ claimedBy: { _id: 'other' }, quantity: 3 }],
    };
    expect(getRemainingForMe(item, 'me')).toBe(1);
  });

  it('counts anonymous claims against capacity for everyone', () => {
    const item = {
      quantity: 4,
      claims: [{ isAnonymousClaim: true, quantity: 2 }],
    };
    expect(getRemainingForMe(item, 'me')).toBe(2);
  });

  it('never goes negative when oversubscribed', () => {
    const item = {
      quantity: 2,
      claims: [{ claimedBy: { _id: 'other' }, quantity: 5 }],
    };
    expect(getRemainingForMe(item, 'me')).toBe(0);
  });
});

describe('isFullyClaimed', () => {
  it('is never true for cash items', () => {
    expect(isFullyClaimed({ type: 'cash', claims: [{ quantity: 999 }] })).toBe(false);
  });

  it('is false when nothing has been claimed', () => {
    expect(isFullyClaimed({ quantity: 3 })).toBe(false);
  });

  it('is false when partially claimed', () => {
    expect(isFullyClaimed({ quantity: 3, claims: [{ quantity: 2 }] })).toBe(false);
  });

  it('is true once claimed quantity meets requested quantity', () => {
    expect(isFullyClaimed({ quantity: 3, claims: [{ quantity: 3 }] })).toBe(true);
  });

  it('is true for a legacy single-mode item with a claimant', () => {
    expect(isFullyClaimed({ status: { claimedBy: { _id: 'u1' } } })).toBe(true);
  });
});
