const {
  sanitizeHandle,
  buildProfileUrl,
  sanitizePaymentLinks,
  hasAnyHandle
} = require('../../utils/paymentLinks');

describe('paymentLinks utility', () => {
  describe('sanitizeHandle', () => {
    it('strips leading @ from venmo handle', () => {
      expect(sanitizeHandle('venmo', '@harry-palmer')).toBe('harry-palmer');
    });

    it('strips leading $ from cashapp handle', () => {
      expect(sanitizeHandle('cashapp', '$harry')).toBe('harry');
    });

    it('trims whitespace', () => {
      expect(sanitizeHandle('paypal', '  harry  ')).toBe('harry');
    });

    it('returns null for empty input', () => {
      expect(sanitizeHandle('venmo', '')).toBeNull();
      expect(sanitizeHandle('venmo', null)).toBeNull();
      expect(sanitizeHandle('venmo', undefined)).toBeNull();
    });

    it('returns null for only-prefix input', () => {
      expect(sanitizeHandle('venmo', '@@@')).toBeNull();
    });

    it('returns null for invalid characters', () => {
      expect(sanitizeHandle('venmo', 'has spaces')).toBeNull();
      expect(sanitizeHandle('paypal', 'has-dash')).toBeNull();
    });

    it('returns null for unknown provider', () => {
      expect(sanitizeHandle('unknown', 'x')).toBeNull();
    });

    it('accepts plain handles without prefixes', () => {
      expect(sanitizeHandle('venmo', 'harry')).toBe('harry');
      expect(sanitizeHandle('paypal', 'harry')).toBe('harry');
      expect(sanitizeHandle('cashapp', 'harry')).toBe('harry');
    });
  });

  describe('buildProfileUrl', () => {
    it('builds venmo URL', () => {
      expect(buildProfileUrl('venmo', 'harry')).toBe('https://venmo.com/u/harry');
    });

    it('builds paypal URL', () => {
      expect(buildProfileUrl('paypal', 'harry')).toBe('https://paypal.me/harry');
    });

    it('builds cashapp URL with $ prefix in path', () => {
      expect(buildProfileUrl('cashapp', 'harry')).toBe('https://cash.app/$harry');
    });

    it('returns null for unknown provider', () => {
      expect(buildProfileUrl('unknown', 'harry')).toBeNull();
    });

    it('returns null for empty handle', () => {
      expect(buildProfileUrl('venmo', '')).toBeNull();
    });
  });

  describe('sanitizePaymentLinks', () => {
    it('cleans all provider handles', () => {
      const { sanitized } = sanitizePaymentLinks({
        venmo: '@harry',
        paypal: '  harry  ',
        cashapp: '$harry'
      });
      expect(sanitized).toEqual({ venmo: 'harry', paypal: 'harry', cashapp: 'harry' });
    });

    it('omits invalid handles', () => {
      const { sanitized } = sanitizePaymentLinks({
        venmo: 'has spaces',
        paypal: 'harry'
      });
      expect(sanitized.venmo).toBeUndefined();
      expect(sanitized.paypal).toBe('harry');
    });

    it('handles missing or non-object input', () => {
      expect(sanitizePaymentLinks(null).sanitized).toEqual({});
      expect(sanitizePaymentLinks(undefined).sanitized).toEqual({});
    });
  });

  describe('hasAnyHandle', () => {
    it('returns true if any handle present', () => {
      expect(hasAnyHandle({ venmo: 'harry' })).toBe(true);
    });

    it('returns false for empty object', () => {
      expect(hasAnyHandle({})).toBe(false);
      expect(hasAnyHandle(null)).toBe(false);
    });
  });
});
