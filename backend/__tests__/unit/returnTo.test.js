const { isSafeReturnTo, takeReturnTo } = require('../../utils/returnTo');

describe('isSafeReturnTo', () => {
  it.each([
    '/api/oauth/consent',
    '/api/oauth/consent?x=1'
  ])('accepts %s', value => expect(isSafeReturnTo(value)).toBe(true));

  it.each([
    undefined,
    null,
    42,
    '',
    '/',
    '/lists',
    'https://evil.example/api/oauth/consent',
    '//evil.example',
    '/api/oauth//evil.example',
    '/api/oauth/../admin',
    '/api/oauth/\\evil',
    '/api/oauth/consent\r\nSet-Cookie: x=1',
    '/api/oauthx/consent',
    'javascript:alert(1)'
  ])('rejects %p', value => expect(isSafeReturnTo(value)).toBe(false));
});

describe('takeReturnTo', () => {
  it('returns the safe value once and clears it', () => {
    const req = { session: { returnTo: '/api/oauth/consent' } };
    expect(takeReturnTo(req)).toBe('/api/oauth/consent');
    expect(req.session.returnTo).toBeUndefined();
    expect(takeReturnTo(req)).toBeNull();
  });

  it('clears and ignores an unsafe value', () => {
    const req = { session: { returnTo: 'https://evil.example' } };
    expect(takeReturnTo(req)).toBeNull();
    expect(req.session.returnTo).toBeUndefined();
  });
});
