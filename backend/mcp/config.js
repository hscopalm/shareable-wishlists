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
    // share_list calls per user per hour (enforced in the tool, in memory).
    shareLimitPerHour: 20,
    // Per-endpoint options for the SDK OAuth handlers (express-rate-limit
    // options), or false to disable them. The SDK keys on req.ip. In
    // production that is a CloudFront edge IP (CloudFront -> ALB with
    // `trust proxy 1`), so hosted MCP clients such as claude.ai, which
    // register and refresh from a few server IPs, share a bucket with each
    // other. These defaults are generous for that reason. Keying per viewer
    // needs CloudFront to forward the viewer IP and the X-Custom-Header
    // origin check to be re-enabled so X-Forwarded-For can be trusted.
    oauthRateLimit: isTest ? false : {
      register: { windowMs: 60 * 60 * 1000, limit: 300 },
      token: { windowMs: 15 * 60 * 1000, limit: 600 },
      authorize: { windowMs: 15 * 60 * 1000, limit: 600 },
      revoke: { windowMs: 15 * 60 * 1000, limit: 300 }
    },
    ...overrides,
    publicBaseUrl
  };
}

module.exports = { getMcpConfig, SCOPES, SUPPORTED_SCOPES };
