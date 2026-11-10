// Helpers for MCP tests: a real HTTP server on an ephemeral port, the SDK
// client pointed at it, and PAT creation.
//
//   const mcp = setupMcpServer();          // registers beforeAll/afterAll
//   const token = await createPat(alice);  // or createPat(alice, 'wishlists:read')
//   const client = await mcpClientFor(token);
//   const result = await callTool(client, 'get_list', { listId });
//   const agent = await loginAgent(mcp.app, alice); // session-authenticated supertest agent
const http = require('http');
const supertest = require('supertest');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createTestApp } = require('./testApp');
const tokens = require('../../mcp/tokens');

function addTestLogin(app) {
  app.get('/test-login/:userId', async (req, res) => {
    const User = require('../../models/User');
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    req.login(user, err => {
      if (err) return res.status(500).json({ message: 'Login failed' });
      res.json({ message: 'Logged in' });
    });
  });
  return app;
}

// App with MCP mounted plus a /test-login/:userId route.
function createMcpTestApp(mcpConfig) {
  return addTestLogin(createTestApp({ mcp: true, mcpConfig }));
}

let current = null;
const openClients = [];

function setupMcpServer({ mcpConfig } = {}) {
  const state = {};
  beforeAll(async () => {
    state.app = createMcpTestApp(mcpConfig);
    state.server = http.createServer(state.app);
    await new Promise(resolve => state.server.listen(0, '127.0.0.1', resolve));
    state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
    current = state;
  });
  afterEach(async () => {
    await Promise.all(openClients.splice(0).map(c => c.close().catch(() => {})));
  });
  afterAll(async () => {
    state.server.closeAllConnections();
    await new Promise(resolve => state.server.close(resolve));
    current = null;
  });
  return state;
}

async function mcpClientFor(token, { baseUrl } = {}) {
  const root = baseUrl || (current && current.baseUrl);
  if (!root) throw new Error('Call setupMcpServer() in the test file first');
  const transport = new StreamableHTTPClientTransport(new URL('/api/mcp', root), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } }
  });
  const client = new Client({ name: 'gift-guru-tests', version: '1.0.0' });
  await client.connect(transport);
  openClients.push(client);
  return client;
}

function callTool(client, name, args = {}) {
  return client.callTool({ name, arguments: args });
}

async function createPat(user, scope = 'wishlists') {
  const { token } = await tokens.createPat({ userId: user._id, name: 'test token', scope });
  return token;
}

async function loginAgent(app, user) {
  const agent = supertest.agent(app);
  await agent.get(`/test-login/${user._id}`).expect(200);
  return agent;
}

module.exports = { setupMcpServer, createMcpTestApp, mcpClientFor, callTool, createPat, loginAgent };
