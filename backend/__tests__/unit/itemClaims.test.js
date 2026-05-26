const { isMultiMode, isCashItem, getClaims, getRequestedQty } = require('../../utils/itemClaims');

describe('itemClaims cash-awareness', () => {
  it('treats cash items as multi-claim regardless of quantity', () => {
    expect(isMultiMode({ type: 'cash' })).toBe(true);
    expect(isMultiMode({ type: 'cash', quantity: 1 })).toBe(true);
    expect(isMultiMode({ type: 'cash', quantity: undefined })).toBe(true);
  });

  it('keeps gift quantity semantics unchanged', () => {
    expect(isMultiMode({ type: 'gift' })).toBe(false);
    expect(isMultiMode({ type: 'gift', quantity: 1 })).toBe(false);
    expect(isMultiMode({ type: 'gift', quantity: 3 })).toBe(true);
    expect(isMultiMode({})).toBe(false);
  });

  it('cash items have no quantity ceiling', () => {
    expect(getRequestedQty({ type: 'cash' })).toBe(Infinity);
  });

  it('isCashItem identifies the type', () => {
    expect(isCashItem({ type: 'cash' })).toBe(true);
    expect(isCashItem({ type: 'gift' })).toBe(false);
    expect(isCashItem({})).toBe(false);
  });

  it('getClaims returns claims[] for cash items unchanged', () => {
    const item = {
      type: 'cash',
      claims: [{ claimedBy: 'u1' }, { claimedBy: 'u2' }]
    };
    expect(getClaims(item)).toHaveLength(2);
  });
});
