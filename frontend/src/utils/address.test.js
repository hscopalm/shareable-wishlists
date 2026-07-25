import { EMPTY_ADDRESS, hasMailingAddress, formatMailingAddress } from './address';

describe('hasMailingAddress', () => {
  it('is false for null/undefined', () => {
    expect(hasMailingAddress(null)).toBe(false);
    expect(hasMailingAddress(undefined)).toBe(false);
  });

  it('is false when every field is empty or whitespace', () => {
    expect(hasMailingAddress(EMPTY_ADDRESS)).toBe(false);
    expect(hasMailingAddress({ ...EMPTY_ADDRESS, line1: '   ' })).toBe(false);
  });

  it('is true when any field has real content', () => {
    expect(hasMailingAddress({ ...EMPTY_ADDRESS, city: 'Seattle' })).toBe(true);
  });
});

describe('formatMailingAddress', () => {
  it('returns null for an empty address', () => {
    expect(formatMailingAddress(EMPTY_ADDRESS)).toBeNull();
    expect(formatMailingAddress(null)).toBeNull();
  });

  it('builds lines in order, joining city/state/zip onto one line', () => {
    const address = {
      recipientName: 'Jamie Lee',
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'USA',
    };
    expect(formatMailingAddress(address)).toEqual([
      'Jamie Lee',
      '123 Main St',
      'Apt 4',
      'Seattle, WA 98101',
      'USA',
    ]);
  });

  it('omits blank fields instead of leaving empty lines', () => {
    const address = { ...EMPTY_ADDRESS, line1: '123 Main St', city: 'Seattle' };
    expect(formatMailingAddress(address)).toEqual(['123 Main St', 'Seattle']);
  });

  it('trims whitespace from each field', () => {
    const address = { ...EMPTY_ADDRESS, recipientName: '  Jamie  ', city: ' Seattle ' };
    expect(formatMailingAddress(address)).toEqual(['Jamie', 'Seattle']);
  });
});
