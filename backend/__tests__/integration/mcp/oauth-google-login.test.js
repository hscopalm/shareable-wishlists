// The production login branch of routes/auth.js (passport Google strategy)
// must send the user back to the OAuth consent page after login, carrying the
// pending authorization across passport's session regeneration. A stub
// strategy named 'google' stands in for Google.
const crypto = require('crypto');
const passport = require('passport');
const supertest = require('supertest');
const { createMcpTestApp } = require('../../helpers/mcp');
const { createTestUsers } = require('../../fixtures/users');

let loginUser = null;
passport.use('google', {
  authenticate() {
    if (loginUser) this.success(loginUser);
    else this.redirect('https://accounts.google.example/o/oauth2');
  }
});

const REDIRECT_URI = 'https://client.example/callback';

let app;
let alice;

beforeEach(async () => {
  app = createMcpTestApp();
  ({ alice } = await createTestUsers());
  loginUser = null;
});

it('returns to consent after the Google callback with the pending request intact', async () => {
  const reg = await supertest(app).post('/api/oauth/register')
    .send({ client_name: 'Google Flow Client', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' })
    .expect(201);
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  const agent = supertest.agent(app);
  const authorize = await agent.get('/api/oauth/authorize').query({
    response_type: 'code',
    client_id: reg.body.client_id,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 's1'
  });
  expect(authorize.headers.location).toBe('/api/auth/google');

  // Google bounces back to the callback with the user.
  loginUser = alice;
  const callback = await agent.get('/api/auth/google/callback');
  expect(callback.status).toBe(302);
  expect(callback.headers.location).toBe('/api/oauth/consent');

  const consent = await agent.get('/api/oauth/consent').expect(200);
  expect(consent.text).toContain('Google Flow Client');
  expect(consent.text).toContain(alice.email);
});

it('keeps the normal post-login redirect when no OAuth flow is in progress', async () => {
  loginUser = alice;
  const res = await supertest(app).get('/api/auth/google/callback');
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe(`${process.env.FRONTEND_URL}/`);
});

it('ignores an unsafe returnTo after the Google callback', async () => {
  app.get('/test-set-return-to', (req, res) => {
    req.session.returnTo = 'https://evil.example/';
    req.session.save(() => res.json({ ok: true }));
  });
  const agent = supertest.agent(app);
  await agent.get('/test-set-return-to').expect(200);
  loginUser = alice;
  const res = await agent.get('/api/auth/google/callback');
  expect(res.headers.location).toBe(`${process.env.FRONTEND_URL}/`);
});

it('shows an error page for consent with no pending request', async () => {
  const res = await supertest(app).get('/api/oauth/consent');
  expect(res.status).toBe(400);
  expect(res.headers['x-frame-options']).toBe('DENY');
  expect(res.headers['cache-control']).toBe('no-store');
});

it('sends an unauthenticated consent visit to login', async () => {
  const reg = await supertest(app).post('/api/oauth/register')
    .send({ client_name: 'C', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' })
    .expect(201);
  const agent = supertest.agent(app);
  await agent.get('/api/oauth/authorize').query({
    response_type: 'code',
    client_id: reg.body.client_id,
    code_challenge: 'x'.repeat(43),
    code_challenge_method: 'S256'
  }).expect(302);
  const res = await agent.get('/api/oauth/consent');
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/api/auth/google');
});
