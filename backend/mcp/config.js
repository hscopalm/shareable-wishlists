// Runtime settings for the MCP server and its OAuth authorization server.
// Read on demand (not at require time) so tests can build apps with
// different settings.

const SCOPES = {
  FULL: 'wishlists',
  READ: 'wishlists:read'
};
const SUPPORTED_SCOPES = [SCOPES.FULL, SCOPES.READ];

function getMcpConfig(overrides = {}) {
  const env = process.env;
  const isTest = env.NODE_ENV === 'test';
  const publicBaseUrl = (overrides.publicBaseUrl || env.PUBLIC_BASE_URL || env.FRONTEND_URL
    || 'https://www.giftguru.cc').replace(/\/+$/, '');

  return {
    enabled: env.MCP_ENABLED === 'true',
    resourceUrl: `${publicBaseUrl}/api/mcp`,
    resourceMetadataUrl: `${publicBaseUrl}/.well-known/oauth-protected-resource/api/mcp`,
    // Requests per minute per authenticated user on /api/mcp. Raised under
    // test so suites can make many calls quickly.
    rateLimitPerMinute: isTest ? 10000 : 60,
    // Passed to the SDK OAuth handlers. false disables their IP-based limits.
    oauthRateLimit: isTest ? false : undefined,
    ...overrides,
    publicBaseUrl
  };
}

module.exports = { getMcpConfig, SCOPES, SUPPORTED_SCOPES };
