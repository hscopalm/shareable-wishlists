const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { requireBearerAuth } = require('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');
const { registerTools } = require('./tools');

const INSTRUCTIONS = `Gift Guru manages gift wishlists. Users own lists of items and share them with friends and family, who claim items so nobody buys the same gift twice.
- Owners never see who claimed items on their own lists. This is by design; do not try to work around it.
- Tool inputs take IDs. Get list IDs from list_my_lists or list_shared_with_me and item IDs from get_list.
- Confirm with the user before deleting anything or sharing a list with someone.`;

function jsonRpcError(res, status, code, message) {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

function buildMcpServer(ctx) {
  const server = new McpServer(
    { name: 'gift-guru', title: 'Gift Guru', version: '1.0.0' },
    { instructions: INSTRUCTIONS }
  );
  registerTools(server, ctx);
  return server;
}

// POST /api/mcp: stateless Streamable HTTP (a fresh server and transport per
// request) with plain JSON responses, because CloudFront and nginx buffer
// SSE badly. There are no sessions, so GET (SSE stream) and DELETE return 405.
function createMcpRouter({ provider, config }) {
  const router = express.Router();

  router.use(cors({
    origin: '*',
    allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Protocol-Version', 'Mcp-Session-Id', 'Last-Event-ID'],
    exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate']
  }));

  // In-memory store: limits are per ECS task. Use a shared (Mongo) store if
  // the service ever scales past one task.
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: config.rateLimitPerMinute,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: req => req.auth.extra.userId,
    handler: (req, res) => jsonRpcError(res, 429, -32000, 'Rate limit exceeded. Try again in a minute.')
  });

  router.post('/',
    requireBearerAuth({ verifier: provider, resourceMetadataUrl: config.resourceMetadataUrl }),
    limiter,
    async (req, res) => {
      const ctx = {
        userId: req.auth.extra.userId,
        scopes: req.auth.scopes,
        clientId: req.auth.clientId,
        clientName: req.auth.extra.clientName
      };
      const server = buildMcpServer(ctx);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error('MCP request failed:', err.message);
        if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
      }
    });

  router.all('/', (req, res) => {
    res.set('Allow', 'POST');
    jsonRpcError(res, 405, -32000, 'Method not allowed. This server is stateless; use POST.');
  });

  return router;
}

module.exports = { createMcpRouter, buildMcpServer, INSTRUCTIONS };
