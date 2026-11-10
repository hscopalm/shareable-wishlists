// Full OAuth 2.1 flow against the real SDK handlers mounted in Express 4,
// with the DEV_AUTO_LOGIN login branch of routes/auth.js. routes/auth.js
// picks its branch at require time, so the env is set before anything loads
// it and restored to 'test' afterwards.
process.env.NODE_ENV = 'development';
process.env.DEV_AUTO_LOGIN = 'true';
process.env.FRONTEND_URL = 'http://localhost';
const helpers = require('../../helpers/mcp');
require('../../../routes/auth');
process.env.NODE_ENV = 'test';

const crypto = require('crypto');
const supertest = require('supertest');
const OAuthClient = require('../../../models/OAuthClient');
const OAuthCode = require('../../../models/OAuthCode');
const ApiToken = require('../../../models/ApiToken');
const User = require('../../../models/User');
const { createTestUsers } = require('../../fixtures/users');
const { createSharedWishlist } = require('../../fixtures/wishlists');

const { setupMcpServer, mcpClientFor, callTool } = helpers;
const mcp = setupMcpServer();

const REDIRECT_URI = 'https://client.example/callback';
const RESOURCE = 'http://localhost/api/mcp';

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function registerClient(overrides = {}) {
  const res = await supertest(mcp.app)
    .post('/api/oauth/register')
    .send({
      client_name: 'Test Assistant',
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      ...overrides
    })
    .expect(201);
  return res.body;
}

function authorizeQuery(client, pkce, overrides = {}) {
  return {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: REDIRECT_URI,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    state: 'state-123',
    scope: 'wishlists',
    resource: RESOURCE,
    ...overrides
  };
}

// Runs authorize -> dev login -> consent page. Returns the agent and CSRF token.
async function startAuthorization(client, pkce, overrides) {
  const agent = supertest.agent(mcp.app);
  const authorize = await agent.get('/api/oauth/authorize').query(authorizeQuery(client, pkce, overrides));
  expect(authorize.status).toBe(302);
  expect(authorize.headers.location).toBe('/api/auth/google');

  const login = await agent.get('/api/auth/google');
  expect(login.status).toBe(302);
  expect(login.headers.location).toBe('/api/oauth/consent');

  const consent = await agent.get('/api/oauth/consent').expect(200);
  const csrf = /name="csrf_token" value="([^"]+)"/.exec(consent.text)[1];
  return { agent, csrf, consentHtml: consent.text };
}

async function authorizeAndGetCode(client, pkce, overrides) {
  const { agent, csrf } = await startAuthorization(client, pkce, overrides);
  const approve = await agent.post('/api/oauth/consent').type('form')
    .send({ csrf_token: csrf, decision: 'approve' });
  expect(approve.status).toBe(302);
  const location = new URL(approve.headers.location);
  expect(location.origin + location.pathname).toBe(REDIRECT_URI);
  expect(location.searchParams.get('state')).toBe('state-123');
  return { code: location.searchParams.get('code'), agent };
}

function tokenRequest(form) {
  return supertest(mcp.app).post('/api/oauth/token').type('form').send(form);
}

function exchangeCode(client, code, verifier, extra = {}) {
  return tokenRequest({
    grant_type: 'authorization_code',
    client_id: client.client_id,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    ...extra
  });
}

function refresh(client, refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: refreshToken });
}

function mcpStatus(token) {
  return supertest(mcp.app)
    .post('/api/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    .then(res => res.status);
}

let alice;
let bob;

beforeEach(async () => {
  ({ alice, bob } = await createTestUsers());
  process.env.DEV_USER_EMAIL = alice.email;
});

describe('OAuth discovery', () => {
  it('serves authorization server metadata pointing at /api/oauth/*', async () => {
    const res = await supertest(mcp.app).get('/.well-known/oauth-authorization-server').expect(200);
    expect(res.body).toMatchObject({
      issuer: 'http://localhost',
      authorization_endpoint: 'http://localhost/api/oauth/authorize',
      token_endpoint: 'http://localhost/api/oauth/token',
      registration_endpoint: 'http://localhost/api/oauth/register',
      revocation_endpoint: 'http://localhost/api/oauth/revoke',
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['wishlists', 'wishlists:read']
    });
  });

  it('serves protected resource metadata at the path-specific and bare URLs', async () => {
    for (const path of ['/.well-known/oauth-protected-resource/api/mcp', '/.well-known/oauth-protected-resource']) {
      const res = await supertest(mcp.app).get(path).expect(200);
      expect(res.body.resource).toBe(RESOURCE);
      expect(res.body.authorization_servers).toEqual(['http://localhost']);
    }
  });
});

describe('OAuth authorization code flow', () => {
  it('runs register -> login -> consent -> PKCE exchange -> tools -> refresh rotation -> revoke', async () => {
    await createSharedWishlist(alice, [bob], { name: 'Birthday' });
    const client = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);

    const tokenRes = await exchangeCode(client, code, pkce.verifier).expect(200);
    expect(tokenRes.body).toMatchObject({ token_type: 'bearer', expires_in: 3600, scope: 'wishlists' });
    expect(tokenRes.body.access_token).toMatch(/^gg_at_/);
    expect(tokenRes.body.refresh_token).toMatch(/^gg_rt_/);

    // Only hashes are stored.
    const stored = await ApiToken.find({});
    expect(JSON.stringify(stored)).not.toContain(tokenRes.body.access_token);
    expect(JSON.stringify(stored)).not.toContain(tokenRes.body.refresh_token);

    // The access token works with the real MCP client and acts as alice.
    const mcpClient = await mcpClientFor(tokenRes.body.access_token);
    const who = await callTool(mcpClient, 'whoami');
    expect(who.structuredContent).toMatchObject({ email: alice.email, client: 'Test Assistant' });
    const lists = await callTool(mcpClient, 'list_my_lists');
    expect(lists.structuredContent.lists.map(l => l.name)).toEqual(['Birthday']);

    // A refresh token is not an access token.
    expect(await mcpStatus(tokenRes.body.refresh_token)).toBe(401);

    // Rotation: new pair issued, old refresh token no longer accepted.
    const rotated = await refresh(client, tokenRes.body.refresh_token).expect(200);
    expect(rotated.body.refresh_token).not.toBe(tokenRes.body.refresh_token);
    expect(await mcpStatus(rotated.body.access_token)).toBe(200);

    // Revoking the refresh token ends the connection, including access tokens.
    await supertest(mcp.app).post('/api/oauth/revoke').type('form')
      .send({ client_id: client.client_id, token: rotated.body.refresh_token })
      .expect(200);
    expect(await mcpStatus(rotated.body.access_token)).toBe(401);
    expect(await mcpStatus(tokenRes.body.access_token)).toBe(401);
    await refresh(client, rotated.body.refresh_token).expect(400);
  });

  it('rejects reuse of a rotated refresh token and revokes the whole connection', async () => {
    const client = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    const first = (await exchangeCode(client, code, pkce.verifier).expect(200)).body;
    const second = (await refresh(client, first.refresh_token).expect(200)).body;

    const reuse = await refresh(client, first.refresh_token);
    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe('invalid_grant');

    expect(await mcpStatus(second.access_token)).toBe(401);
    await refresh(client, second.refresh_token).expect(400);
  });

  it('skips login when the user already has a session', async () => {
    const client = await registerClient();
    const pkce = pkcePair();
    const { agent } = await authorizeAndGetCode(client, pkce);
    const again = await agent.get('/api/oauth/authorize').query(authorizeQuery(client, pkcePair()));
    expect(again.status).toBe(302);
    expect(again.headers.location).toBe('/api/oauth/consent');
  });

  it('renders client-supplied strings escaped on the consent page', async () => {
    const client = await registerClient({ client_name: '<script>alert("x")</script>' });
    const { consentHtml } = await startAuthorization(client, pkcePair());
    expect(consentHtml).not.toContain('<script>');
    expect(consentHtml).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(consentHtml).toContain('client.example');
    expect(consentHtml).toContain(alice.email);
  });

  it('redirects with access_denied when the user denies', async () => {
    const client = await registerClient();
    const { agent, csrf } = await startAuthorization(client, pkcePair());
    const res = await agent.post('/api/oauth/consent').type('form').send({ csrf_token: csrf, decision: 'deny' });
    const location = new URL(res.headers.location);
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('state')).toBe('state-123');
    expect(location.searchParams.get('code')).toBeNull();
    expect(await OAuthCode.countDocuments()).toBe(0);
  });

  it('rejects a consent POST with a missing or wrong CSRF token', async () => {
    const client = await registerClient();
    const { agent } = await startAuthorization(client, pkcePair());
    await agent.post('/api/oauth/consent').type('form').send({ decision: 'approve' }).expect(403);
    await agent.post('/api/oauth/consent').type('form').send({ csrf_token: 'wrong', decision: 'approve' }).expect(403);
    expect(await OAuthCode.countDocuments()).toBe(0);
  });

  it('allows only one decision per authorization request', async () => {
    const client = await registerClient();
    const { agent, csrf } = await startAuthorization(client, pkcePair());
    await agent.post('/api/oauth/consent').type('form').send({ csrf_token: csrf, decision: 'approve' }).expect(302);
    await agent.post('/api/oauth/consent').type('form').send({ csrf_token: csrf, decision: 'approve' }).expect(403);
    expect(await OAuthCode.countDocuments()).toBe(1);
  });

  it('redirects unsupported scopes back with invalid_scope', async () => {
    const client = await registerClient();
    const res = await supertest(mcp.app).get('/api/oauth/authorize')
      .query(authorizeQuery(client, pkcePair(), { scope: 'admin' }));
    expect(res.status).toBe(302);
    expect(new URL(res.headers.location).searchParams.get('error')).toBe('invalid_scope');
  });

  it('issues read-only tokens for the wishlists:read scope', async () => {
    const client = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce, { scope: 'wishlists:read' });
    const tokens = (await exchangeCode(client, code, pkce.verifier).expect(200)).body;
    expect(tokens.scope).toBe('wishlists:read');
  });
});

describe('OAuth failure cases', () => {
  it('fails the exchange with a wrong code_verifier', async () => {
    const client = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    const res = await exchangeCode(client, code, pkcePair().verifier);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });

  it('accepts an authorization code only once', async () => {
    const client = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    await exchangeCode(client, code, pkce.verifier).expect(200);
    const reuse = await exchangeCode(client, code, pkce.verifier);
    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe('invalid_grant');
  });

  it('accepts exactly one of two concurrent redemptions of the same code', async () => {
    const client = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    const results = await Promise.all([
      exchangeCode(client, code, pkce.verifier),
      exchangeCode(client, code, pkce.verifier)
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
  });

  it('rejects an expired code', async () => {
    const client = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    await OAuthCode.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await exchangeCode(client, code, pkce.verifier);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });

  it('rejects an unregistered redirect_uri at authorize without redirecting', async () => {
    const client = await registerClient();
    const res = await supertest(mcp.app).get('/api/oauth/authorize')
      .query(authorizeQuery(client, pkcePair(), { redirect_uri: 'https://evil.example/callback' }));
    expect(res.status).toBe(400);
    expect(res.headers.location).toBeUndefined();
  });

  it('rejects a token request whose redirect_uri differs from the authorization request', async () => {
    const client = await registerClient({ redirect_uris: [REDIRECT_URI, 'https://client.example/other'] });
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    const res = await exchangeCode(client, code, pkce.verifier, { redirect_uri: 'https://client.example/other' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });

  it('rejects a code issued to a different client', async () => {
    const client = await registerClient();
    const other = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    const res = await exchangeCode(other, code, pkce.verifier);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });

  it('rejects a resource other than this MCP server', async () => {
    const client = await registerClient();
    const res = await supertest(mcp.app).get('/api/oauth/authorize')
      .query(authorizeQuery(client, pkcePair(), { resource: 'https://other.example/mcp' }));
    expect(res.status).toBe(302);
    expect(new URL(res.headers.location).searchParams.get('error')).toBe('invalid_target');
  });

  it('rejects tokens of a user who became pending', async () => {
    const client = await registerClient();
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    const tokens = (await exchangeCode(client, code, pkce.verifier).expect(200)).body;
    await User.updateOne({ _id: alice._id }, { $set: { isPending: true } });
    expect(await mcpStatus(tokens.access_token)).toBe(401);
    await refresh(client, tokens.refresh_token).expect(400);
  });
});

describe('confidential clients', () => {
  it('stores only the secret hash and requires the secret at the token endpoint', async () => {
    const client = await registerClient({ token_endpoint_auth_method: 'client_secret_post' });
    expect(client.client_secret).toBeTruthy();
    const doc = await OAuthClient.findOne({ clientId: client.client_id }).lean();
    expect(JSON.stringify(doc)).not.toContain(client.client_secret);

    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);

    const missing = await exchangeCode(client, code, pkce.verifier);
    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe('invalid_client');
    const wrong = await exchangeCode(client, code, pkce.verifier, { client_secret: 'nope' });
    expect(wrong.status).toBe(401);

    await exchangeCode(client, code, pkce.verifier, { client_secret: client.client_secret }).expect(200);
  });

  it('accepts client_secret_basic', async () => {
    const client = await registerClient({ token_endpoint_auth_method: 'client_secret_basic' });
    const pkce = pkcePair();
    const { code } = await authorizeAndGetCode(client, pkce);
    const basic = Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64');
    await supertest(mcp.app).post('/api/oauth/token').type('form')
      .set('Authorization', `Basic ${basic}`)
      .send({ grant_type: 'authorization_code', code, code_verifier: pkce.verifier, redirect_uri: REDIRECT_URI })
      .expect(200);
  });

  it('requires the secret to revoke', async () => {
    const client = await registerClient({ token_endpoint_auth_method: 'client_secret_post' });
    await supertest(mcp.app).post('/api/oauth/revoke').type('form')
      .send({ client_id: client.client_id, token: 'whatever' })
      .expect(401);
  });
});

describe('post-login returnTo (DEV_AUTO_LOGIN branch)', () => {
  beforeAll(() => {
    mcp.app.get('/test-set-return-to', (req, res) => {
      req.session.returnTo = req.query.to;
      req.session.save(() => res.json({ ok: true }));
    });
  });

  it.each([
    'https://evil.example/',
    '//evil.example/api/oauth/',
    '/api/oauth/../../evil',
    '/\\evil.example'
  ])('ignores unsafe returnTo %s and lands on the frontend', async (to) => {
    const agent = supertest.agent(mcp.app);
    await agent.get('/test-set-return-to').query({ to }).expect(200);
    const res = await agent.get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost/');
  });

  it('logs in without returnTo exactly as before', async () => {
    const res = await supertest(mcp.app).get('/api/auth/google');
    expect(res.headers.location).toBe('http://localhost/');
  });
});
