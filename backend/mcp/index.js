const express = require('express');
const { getMcpConfig } = require('./config');
const { createProvider } = require('./oauthProvider');
const { createOAuthRouter, createWellKnownRouter } = require('./oauthRoutes');
const { createMcpRouter } = require('./server');
const tokens = require('./tokens');

// Paths that serve bearer-token or public OAuth traffic and set their own
// permissive CORS (no cookies involved). server.js skips the app-wide CORS
// policy for these.
const PUBLIC_CORS_PATH = /^\/(api\/mcp\/?$|api\/oauth\/(token|register|revoke)\/?$|\.well-known\/oauth-)/;

function sendError(res, err) {
  if (err && err.status) return res.status(err.status).json({ message: err.message });
  console.error('MCP token route failed:', err);
  res.status(500).json({ message: 'Server error' });
}

function createTokenRouter() {
  const router = express.Router();
  router.get('/', async (req, res) => {
    try {
      res.json(await tokens.listTokens({ userId: req.user._id }));
    } catch (err) { sendError(res, err); }
  });
  router.post('/', async (req, res) => {
    try {
      const { name, scope } = req.body || {};
      res.status(201).json(await tokens.createPat({ userId: req.user._id, name, scope }));
    } catch (err) { sendError(res, err); }
  });
  router.delete('/connections/:clientId', async (req, res) => {
    try {
      res.json(await tokens.revokeConnection({ userId: req.user._id, clientId: req.params.clientId }));
    } catch (err) { sendError(res, err); }
  });
  router.delete('/:id', async (req, res) => {
    try {
      res.json(await tokens.revokePat({ userId: req.user._id, tokenId: req.params.id }));
    } catch (err) { sendError(res, err); }
  });
  return router;
}

// Mount the MCP endpoint, OAuth authorization server, discovery documents and
// token management routes. Must run after session and passport middleware
// and before the catch-all `/api` routers. When MCP is disabled every one of
// these paths returns 404.
function mountMcp(app, { requireAuth, config = getMcpConfig() }) {
  const notFound = (req, res) => res.status(404).json({ message: 'Not found' });
  if (!config.enabled) {
    app.use(['/api/mcp', '/api/mcp-tokens', '/api/oauth'], notFound);
    app.use(/^\/\.well-known\/oauth-/, notFound);
    return;
  }

  const provider = createProvider(config);
  app.use(createWellKnownRouter({ provider, config }));
  app.use('/api/oauth', createOAuthRouter({ provider, config }));
  app.use('/api/mcp-tokens', requireAuth, createTokenRouter());
  app.use('/api/mcp', createMcpRouter({ provider, config }));
}

module.exports = { mountMcp, PUBLIC_CORS_PATH };
