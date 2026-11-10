const express = require('express');
const cors = require('cors');
const { authorizationHandler, redirectUriMatches } = require('@modelcontextprotocol/sdk/server/auth/handlers/authorize.js');
const { tokenHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/token.js');
const { clientRegistrationHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/register.js');
const { revocationHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/revoke.js');
const { metadataHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/metadata.js');
const { createOAuthMetadata } = require('@modelcontextprotocol/sdk/server/auth/router.js');
const OAuthClient = require('../models/OAuthClient');
const { hashSecret, safeEqual, randomSecret } = require('./tokens');
const { SUPPORTED_SCOPES } = require('./config');
const { isPendingFresh, isActiveUser, CONSENT_PATH, LOGIN_PATH } = require('./oauthProvider');
const { renderConsentPage, renderErrorPage } = require('./consentPage');

// The SDK's mcpAuthRouter mounts everything at the site root. We compose its
// individual handlers under /api/oauth instead, so CloudFront only has to
// route /.well-known/oauth-* in addition to the existing /api/* behaviour.

function invalidClient(res, description) {
  res.status(401).json({ error: 'invalid_client', error_description: description });
}

// Confidential client authentication for /token and /revoke. Accepts
// client_secret_post and client_secret_basic, compares secret hashes in
// constant time. Public clients (no stored secret) pass straight through and
// the SDK handler takes over.
async function verifyClientSecret(req, res, next) {
  if (req.method !== 'POST') return next();
  try {
    req.body = req.body || {};
    const basic = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
    if (basic && !req.body.client_id) {
      const decoded = Buffer.from(basic[1], 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      if (sep === -1) return invalidClient(res, 'Malformed Basic credentials');
      try {
        req.body.client_id = decodeURIComponent(decoded.slice(0, sep));
        req.body.client_secret = decodeURIComponent(decoded.slice(sep + 1));
      } catch {
        return invalidClient(res, 'Malformed Basic credentials');
      }
    }

    const clientId = req.body.client_id;
    if (typeof clientId !== 'string') return next();
    const client = await OAuthClient.findOne({ clientId });
    if (!client || !client.clientSecretHash) return next();

    const secret = req.body.client_secret;
    if (typeof secret !== 'string' || !safeEqual(hashSecret(secret), client.clientSecretHash)) {
      return invalidClient(res, 'Invalid client credentials');
    }
    if (client.clientSecretExpiresAt && client.clientSecretExpiresAt < Math.floor(Date.now() / 1000)) {
      return invalidClient(res, 'Client secret has expired');
    }
    next();
  } catch (err) {
    next(err);
  }
}

function setPageHeaders(res) {
  res.set({
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer'
  });
}

function isLoggedIn(req) {
  return Boolean(req.isAuthenticated && req.isAuthenticated() && isActiveUser(req.user));
}

function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save(err => (err ? reject(err) : resolve())));
}

function createOAuthRouter({ provider, config }) {
  const router = express.Router();
  const rateLimit = config.oauthRateLimit;

  router.use(['/token', '/revoke'], cors(), express.urlencoded({ extended: false }), verifyClientSecret);
  router.use('/authorize', authorizationHandler({ provider, rateLimit }));
  router.use('/token', tokenHandler({ provider, rateLimit }));
  router.use('/revoke', revocationHandler({ provider, rateLimit }));
  router.use('/register', clientRegistrationHandler({
    clientsStore: provider.clientsStore,
    rateLimit,
    clientSecretExpirySeconds: 0 // secrets do not expire; users revoke connections instead
  }));

  router.get('/consent', async (req, res, next) => {
    try {
      setPageHeaders(res);
      const pending = req.session && req.session.oauthPending;
      if (!isPendingFresh(pending)) {
        return res.status(400).send(renderErrorPage('This authorization request is missing or has expired.'));
      }
      if (!isLoggedIn(req)) {
        req.session.returnTo = CONSENT_PATH;
        await saveSession(req);
        return res.redirect(302, LOGIN_PATH);
      }
      const client = await provider.clientsStore.getClient(pending.clientId);
      if (!client) {
        return res.status(400).send(renderErrorPage('The application is no longer registered.'));
      }

      pending.csrf = randomSecret();
      req.session.oauthPending = pending;
      await saveSession(req);

      res.send(renderConsentPage({
        clientName: client.client_name,
        redirectUri: pending.redirectUri,
        scopes: pending.scopes,
        userEmail: req.user.email,
        csrfToken: pending.csrf
      }));
    } catch (err) {
      next(err);
    }
  });

  router.post('/consent', express.urlencoded({ extended: false }), async (req, res, next) => {
    try {
      setPageHeaders(res);
      const pending = req.session && req.session.oauthPending;
      const csrf = req.body && req.body.csrf_token;
      if (!isPendingFresh(pending) || !pending.csrf || !safeEqual(csrf, pending.csrf)) {
        return res.status(403).send(renderErrorPage('This authorization request is invalid or has expired.'));
      }
      if (!isLoggedIn(req)) {
        return res.status(403).send(renderErrorPage('Your session has ended. Please start again.'));
      }

      // One decision per authorization request.
      delete req.session.oauthPending;

      const client = await provider.clientsStore.getClient(pending.clientId);
      if (!client || !client.redirect_uris.some(r => redirectUriMatches(pending.redirectUri, r))) {
        await saveSession(req);
        return res.status(400).send(renderErrorPage('The application is no longer registered.'));
      }

      const target = new URL(pending.redirectUri);
      if (req.body.decision === 'approve') {
        const code = await provider.createAuthorizationCode({ pending, userId: req.user._id });
        target.searchParams.set('code', code);
      } else {
        target.searchParams.set('error', 'access_denied');
        target.searchParams.set('error_description', 'The user denied the request');
      }
      if (pending.state) target.searchParams.set('state', pending.state);

      await saveSession(req);
      res.redirect(302, target.href);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// Discovery documents: RFC 8414 authorization server metadata and RFC 9728
// protected resource metadata (path-specific plus bare, for clients that
// ignore the resource path).
function createWellKnownRouter({ provider, config }) {
  const base = config.publicBaseUrl;
  const sdkMetadata = createOAuthMetadata({
    provider,
    issuerUrl: new URL(base),
    scopesSupported: SUPPORTED_SCOPES
  });
  const authServerMetadata = {
    ...sdkMetadata,
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    revocation_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none']
  };
  const protectedResourceMetadata = {
    resource: config.resourceUrl,
    authorization_servers: [base],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Gift Guru'
  };

  const router = express.Router();
  router.use('/.well-known/oauth-authorization-server', metadataHandler(authServerMetadata));
  router.use('/.well-known/oauth-protected-resource/api/mcp', metadataHandler(protectedResourceMetadata));
  router.use('/.well-known/oauth-protected-resource', metadataHandler(protectedResourceMetadata));
  return router;
}

module.exports = { createOAuthRouter, createWellKnownRouter, verifyClientSecret };
