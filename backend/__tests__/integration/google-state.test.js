// The real Google strategy must use an OAuth `state` bound to the session, so
// an attacker can't complete a login in someone else's browser (login CSRF).
// Nothing here talks to Google: state is checked before any token exchange.
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

const express = require('express');
const session = require('express-session');
const supertest = require('supertest');
const passport = require('../../config/passport');

function buildApp() {
  const app = express();
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.get('/login', passport.authenticate('google', { scope: ['profile', 'email'] }));
  app.get('/callback',
    passport.authenticate('google', { failureRedirect: '/failed' }),
    (req, res) => res.send('logged in'));
  return app;
}

it('sends a state parameter to Google', async () => {
  const res = await supertest(buildApp()).get('/login').expect(302);
  const location = new URL(res.headers.location);
  expect(location.hostname).toBe('accounts.google.com');
  expect(location.searchParams.get('state')).toMatch(/.{8,}/);
});

it('rejects a callback whose state was not issued to this browser', async () => {
  const app = buildApp();
  const victim = supertest.agent(app);
  await victim.get('/login').expect(302);

  const res = await victim.get('/callback').query({ code: 'attacker-code', state: 'forged-state' });
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/failed');
});

it('rejects a callback with no state at all', async () => {
  const res = await supertest(buildApp()).get('/callback').query({ code: 'attacker-code' });
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/failed');
});
