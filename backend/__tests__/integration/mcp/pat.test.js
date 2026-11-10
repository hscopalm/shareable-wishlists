const supertest = require('supertest');
const ApiToken = require('../../../models/ApiToken');
const { issueToken } = require('../../../mcp/tokens');
const { setupMcpServer, mcpClientFor, callTool, loginAgent } = require('../../helpers/mcp');
const { createTestUsers } = require('../../fixtures/users');
const { createSharedWishlist } = require('../../fixtures/wishlists');

const mcp = setupMcpServer();

function mcpPost(token) {
  return supertest(mcp.app)
    .post('/api/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
}

let alice;
let bob;

beforeEach(async () => {
  ({ alice, bob } = await createTestUsers());
});

describe('personal access token lifecycle', () => {
  it('creates a token shown once, uses it, lists it without secrets, revokes it', async () => {
    const agent = await loginAgent(mcp.app, alice);

    const created = await agent.post('/api/mcp-tokens').send({ name: 'Laptop', scope: 'wishlists' }).expect(201);
    const { token, id } = created.body;
    expect(token).toMatch(/^gg_pat_/);
    expect(created.body).toMatchObject({ name: 'Laptop', scope: 'wishlists', prefix: token.slice(0, 12) });

    const stored = await ApiToken.findById(id).lean();
    expect(JSON.stringify(stored)).not.toContain(token);

    const client = await mcpClientFor(token);
    const who = await callTool(client, 'whoami');
    expect(who.structuredContent.email).toBe(alice.email);

    const list = await agent.get('/api/mcp-tokens').expect(200);
    expect(list.body.tokens).toHaveLength(1);
    expect(list.body.tokens[0]).toMatchObject({ id, name: 'Laptop', prefix: token.slice(0, 12) });
    expect(list.body.tokens[0].lastUsedAt).toBeTruthy();
    expect(JSON.stringify(list.body)).not.toContain(token);
    expect(JSON.stringify(list.body)).not.toContain(stored.tokenHash);

    await agent.delete(`/api/mcp-tokens/${id}`).expect(200);
    const after = await mcpPost(token);
    expect(after.status).toBe(401);
    expect((await agent.get('/api/mcp-tokens')).body.tokens).toHaveLength(0);
  });

  it('validates name and scope', async () => {
    const agent = await loginAgent(mcp.app, alice);
    await agent.post('/api/mcp-tokens').send({ name: 'x', scope: 'admin' }).expect(400);
    await agent.post('/api/mcp-tokens').send({ name: '  ', scope: 'wishlists' }).expect(400);
    await agent.post('/api/mcp-tokens').send({ name: 'a'.repeat(101), scope: 'wishlists' }).expect(400);
  });

  it('requires a session (bearer tokens cannot manage tokens)', async () => {
    const agent = await loginAgent(mcp.app, alice);
    const { token } = (await agent.post('/api/mcp-tokens').send({ name: 'x', scope: 'wishlists' })).body;
    await supertest(mcp.app).get('/api/mcp-tokens').expect(401);
    await supertest(mcp.app).post('/api/mcp-tokens').set('Authorization', `Bearer ${token}`)
      .send({ name: 'y', scope: 'wishlists' }).expect(401);
  });

  it('blocks a read-only PAT from write tools but allows reads', async () => {
    const list = await createSharedWishlist(bob, [alice], { items: [{ title: 'Kite' }] });
    const agent = await loginAgent(mcp.app, alice);
    const { token } = (await agent.post('/api/mcp-tokens').send({ name: 'ro', scope: 'wishlists:read' })).body;
    const client = await mcpClientFor(token);

    const read = await callTool(client, 'get_list', { listId: list._id.toString() });
    expect(read.isError).toBeFalsy();

    const write = await callTool(client, 'claim_item', {
      listId: list._id.toString(),
      itemId: list.items[0]._id.toString()
    });
    expect(write.isError).toBe(true);
    expect(write.content[0].text).toMatch(/requires the wishlists scope/);
  });
});

describe('token management authorization', () => {
  it('lets users see and revoke only their own tokens and connections', async () => {
    const aliceAgent = await loginAgent(mcp.app, alice);
    const bobAgent = await loginAgent(mcp.app, bob);
    const { id, token } = (await aliceAgent.post('/api/mcp-tokens').send({ name: 'mine', scope: 'wishlists' })).body;
    await issueToken({ kind: 'oauth_access', userId: alice._id, clientId: 'client-a', scopes: ['wishlists'], name: 'Claude' });

    const bobView = await bobAgent.get('/api/mcp-tokens').expect(200);
    expect(bobView.body).toEqual({ tokens: [], connections: [] });

    await bobAgent.delete(`/api/mcp-tokens/${id}`).expect(404);
    await bobAgent.delete('/api/mcp-tokens/connections/client-a').expect(404);
    await bobAgent.delete('/api/mcp-tokens/not-an-id').expect(404);

    expect((await mcpPost(token)).status).toBe(200);
    expect((await aliceAgent.get('/api/mcp-tokens')).body.connections).toHaveLength(1);
  });

  it('groups OAuth connections by client and revokes all of a client\'s tokens', async () => {
    const agent = await loginAgent(mcp.app, alice);
    const common = { userId: alice._id, clientId: 'client-a', scopes: ['wishlists'], name: 'Claude' };
    const access = await issueToken({ ...common, kind: 'oauth_access', expiresAt: new Date(Date.now() + 60000) });
    await issueToken({ ...common, kind: 'oauth_refresh', expiresAt: new Date(Date.now() + 60000) });
    await issueToken({ ...common, clientId: 'client-b', name: 'Other', kind: 'oauth_access', expiresAt: new Date(Date.now() + 60000) });

    const list = (await agent.get('/api/mcp-tokens').expect(200)).body;
    expect(list.tokens).toHaveLength(0);
    expect(list.connections.map(c => c.clientName).sort()).toEqual(['Claude', 'Other']);

    await agent.delete('/api/mcp-tokens/connections/client-a').expect(200);
    expect((await mcpPost(access.token)).status).toBe(401);
    const after = (await agent.get('/api/mcp-tokens')).body;
    expect(after.connections.map(c => c.clientId)).toEqual(['client-b']);
  });
});
