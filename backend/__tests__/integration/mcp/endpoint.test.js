const supertest = require('supertest');
const { setupMcpServer, createMcpTestApp, createPat, loginAgent } = require('../../helpers/mcp');
const { createTestUsers } = require('../../fixtures/users');

const mcp = setupMcpServer();
const PRM_URL = 'http://localhost/.well-known/oauth-protected-resource/api/mcp';

function rpc(app, token) {
  const req = supertest(app).post('/api/mcp').set('Accept', 'application/json, text/event-stream');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
}

let alice;
beforeEach(async () => {
  ({ alice } = await createTestUsers());
});

describe('/api/mcp authentication', () => {
  it('returns 401 with WWW-Authenticate resource_metadata when no token is sent', async () => {
    const res = await rpc(mcp.app);
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(/^Bearer /);
    expect(res.headers['www-authenticate']).toContain(`resource_metadata="${PRM_URL}"`);
  });

  it('returns 401 for an unknown token', async () => {
    const res = await rpc(mcp.app, 'gg_pat_nottherealtoken');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('resource_metadata=');
  });

  it('answers tools/list with a JSON (not SSE) response for a valid token', async () => {
    const res = await rpc(mcp.app, await createPat(alice));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const names = res.body.result.tools.map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['whoami', 'list_my_lists', 'get_list', 'claim_item']));
    for (const tool of res.body.result.tools) {
      expect(tool.annotations).toMatchObject({ openWorldHint: false, title: expect.any(String) });
      expect(typeof tool.annotations.readOnlyHint).toBe('boolean');
    }
  });

  it('returns 405 for GET and DELETE (stateless server)', async () => {
    const token = await createPat(alice);
    await supertest(mcp.app).get('/api/mcp').set('Authorization', `Bearer ${token}`).expect(405);
    await supertest(mcp.app).delete('/api/mcp').set('Authorization', `Bearer ${token}`).expect(405);
  });
});

describe('rate limiting', () => {
  it('limits requests per user per minute', async () => {
    const app = createMcpTestApp({ rateLimitPerMinute: 2 });
    const token = await createPat(alice);
    expect((await rpc(app, token)).status).toBe(200);
    expect((await rpc(app, token)).status).toBe(200);
    const limited = await rpc(app, token);
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/Rate limit/);
  });
});

describe('MCP_ENABLED=false', () => {
  it('404s the MCP endpoint, OAuth routes, discovery and token routes', async () => {
    const app = createMcpTestApp({ enabled: false });
    const token = await createPat(alice);
    expect((await rpc(app, token)).status).toBe(404);
    await supertest(app).get('/api/oauth/authorize').expect(404);
    await supertest(app).post('/api/oauth/token').expect(404);
    await supertest(app).post('/api/oauth/register').send({}).expect(404);
    await supertest(app).get('/api/oauth/consent').expect(404);
    await supertest(app).get('/.well-known/oauth-authorization-server').expect(404);
    await supertest(app).get('/.well-known/oauth-protected-resource/api/mcp').expect(404);
    await supertest(app).get('/.well-known/oauth-protected-resource').expect(404);

    const agent = await loginAgent(app, alice);
    await agent.get('/api/mcp-tokens').expect(404);
    await agent.post('/api/mcp-tokens').send({ name: 'x', scope: 'wishlists' }).expect(404);
  });

  it('defaults to disabled when MCP_ENABLED is unset', () => {
    const { getMcpConfig } = require('../../../mcp/config');
    const saved = process.env.MCP_ENABLED;
    delete process.env.MCP_ENABLED;
    expect(getMcpConfig().enabled).toBe(false);
    process.env.MCP_ENABLED = 'true';
    expect(getMcpConfig().enabled).toBe(true);
    if (saved === undefined) delete process.env.MCP_ENABLED; else process.env.MCP_ENABLED = saved;
  });
});
