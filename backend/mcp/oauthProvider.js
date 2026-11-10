const OAuthClient = require('../models/OAuthClient');
const OAuthCode = require('../models/OAuthCode');
const ApiToken = require('../models/ApiToken');
const User = require('../models/User');
const {
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError
} = require('@modelcontextprotocol/sdk/server/auth/errors.js');
const { hashSecret, randomSecret, issueToken } = require('./tokens');
const { SCOPES, SUPPORTED_SCOPES } = require('./config');

const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const LAST_USED_RESOLUTION_MS = 60 * 1000;

const CONSENT_PATH = '/api/oauth/consent';
const LOGIN_PATH = '/api/auth/google';

// Resource indicators (RFC 8707) compare without fragment or trailing slash.
function sameResource(a, b) {
  const norm = v => String(v).split('#')[0].replace(/\/$/, '');
  return norm(a) === norm(b);
}

function isActiveUser(user) {
  return Boolean(user && !user.isPending);
}

// Mongo document -> the OAuthClientInformationFull shape the SDK expects.
// The secret hash is deliberately left out: the SDK's own client
// authentication compares plaintext secrets, so it must see every client as
// public. verifyClientSecret (in oauthRoutes.js) checks the hash instead and
// runs before the SDK token and revocation handlers.
function toClientInfo(doc) {
  return {
    ...doc.metadata,
    client_id: doc.clientId,
    client_id_issued_at: doc.clientIdIssuedAt,
    client_name: doc.clientName,
    redirect_uris: doc.redirectUris
  };
}

const clientsStore = {
  async getClient(clientId) {
    if (typeof clientId !== 'string') return undefined;
    const doc = await OAuthClient.findOne({ clientId });
    return doc ? toClientInfo(doc) : undefined;
  },

  async registerClient(info) {
    const { client_secret, client_secret_expires_at, client_id, client_id_issued_at,
      client_name, redirect_uris, ...metadata } = info;
    await OAuthClient.create({
      clientId: client_id,
      clientSecretHash: client_secret ? hashSecret(client_secret) : undefined,
      clientSecretExpiresAt: client_secret_expires_at,
      clientIdIssuedAt: client_id_issued_at,
      clientName: client_name,
      redirectUris: redirect_uris,
      metadata
    });
    // Returned to the registering client once; only the hash is kept.
    return info;
  }
};

function normalizeScopes(requested) {
  const scopes = (requested || []).filter(Boolean);
  if (scopes.length === 0) return [SCOPES.FULL];
  const unknown = scopes.filter(s => !SUPPORTED_SCOPES.includes(s));
  if (unknown.length) {
    throw new InvalidScopeError(`Unsupported scope: ${unknown.join(' ')}`);
  }
  return [...new Set(scopes)];
}

function createProvider(config) {
  function checkResource(resource) {
    if (resource && !sameResource(resource, config.resourceUrl)) {
      throw new InvalidTargetError('Unknown resource');
    }
  }

  async function issueTokenPair({ userId, clientId, clientName, scopes, resource }) {
    const now = Date.now();
    const common = { userId, clientId, scopes, name: clientName, resource };
    const access = await issueToken({ ...common, kind: 'oauth_access', expiresAt: new Date(now + ACCESS_TTL_MS) });
    const refresh = await issueToken({ ...common, kind: 'oauth_refresh', expiresAt: new Date(now + REFRESH_TTL_MS) });
    return {
      access_token: access.token,
      token_type: 'bearer',
      expires_in: ACCESS_TTL_MS / 1000,
      refresh_token: refresh.token,
      scope: scopes.join(' ')
    };
  }

  async function requireActiveUser(userId) {
    const user = await User.findById(userId);
    if (!isActiveUser(user)) throw new InvalidGrantError('User is not active');
    return user;
  }

  return {
    clientsStore,

    // Called by the SDK authorization handler after it has validated
    // client_id, redirect_uri and the PKCE parameters. We stash the request
    // in the session and send the browser to login (if needed) and consent.
    async authorize(client, params, res) {
      const req = res.req;
      const scopes = normalizeScopes(params.scopes);
      checkResource(params.resource);

      req.session.oauthPending = {
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        state: params.state,
        scopes,
        codeChallenge: params.codeChallenge,
        resource: params.resource ? params.resource.href : undefined,
        createdAt: Date.now()
      };

      const loggedIn = req.isAuthenticated && req.isAuthenticated() && isActiveUser(req.user);
      if (!loggedIn) req.session.returnTo = CONSENT_PATH;

      await new Promise((resolve, reject) => req.session.save(err => (err ? reject(err) : resolve())));
      res.redirect(302, loggedIn ? CONSENT_PATH : LOGIN_PATH);
    },

    async challengeForAuthorizationCode(client, code) {
      const doc = await OAuthCode.findOne({
        codeHash: hashSecret(code),
        clientId: client.client_id,
        expiresAt: { $gt: new Date() }
      });
      if (!doc) throw new InvalidGrantError('Invalid or expired authorization code');
      return doc.codeChallenge;
    },

    async exchangeAuthorizationCode(client, code, _codeVerifier, redirectUri, resource) {
      // Deleting on lookup makes the code single-use even under concurrent
      // redemption attempts: only one request gets the document back.
      const doc = await OAuthCode.findOneAndDelete({
        codeHash: hashSecret(code),
        clientId: client.client_id,
        expiresAt: { $gt: new Date() }
      });
      if (!doc) throw new InvalidGrantError('Invalid or expired authorization code');
      if (redirectUri !== undefined && redirectUri !== doc.redirectUri) {
        throw new InvalidGrantError('redirect_uri does not match the authorization request');
      }
      checkResource(resource);
      if (resource && doc.resource && !sameResource(resource, doc.resource)) {
        throw new InvalidTargetError('resource does not match the authorization request');
      }
      await requireActiveUser(doc.user);

      return issueTokenPair({
        userId: doc.user,
        clientId: client.client_id,
        clientName: client.client_name,
        scopes: doc.scopes,
        resource: doc.resource
      });
    },

    async exchangeRefreshToken(client, refreshToken, scopes, resource) {
      const tokenHash = hashSecret(refreshToken);
      const now = new Date();
      // Rotation: the refresh token is revoked in the same atomic step that
      // finds it, so it can be redeemed once.
      const doc = await ApiToken.findOneAndUpdate(
        {
          tokenHash,
          kind: 'oauth_refresh',
          clientId: client.client_id,
          revokedAt: null,
          expiresAt: { $gt: now }
        },
        { $set: { revokedAt: now, lastUsedAt: now } }
      );
      if (!doc) {
        // Reuse of an already-rotated refresh token suggests it was stolen:
        // revoke every token in this user's connection to this client.
        const reused = await ApiToken.findOne({ tokenHash, kind: 'oauth_refresh', clientId: client.client_id });
        if (reused && reused.revokedAt) {
          await ApiToken.updateMany(
            { user: reused.user, clientId: client.client_id, revokedAt: null },
            { $set: { revokedAt: now } }
          );
        }
        throw new InvalidGrantError('Invalid or expired refresh token');
      }

      let granted = doc.scopes;
      if (scopes && scopes.length) {
        if (!scopes.every(s => doc.scopes.includes(s))) {
          throw new InvalidScopeError('Requested scope exceeds the original grant');
        }
        granted = scopes;
      }
      checkResource(resource);
      await requireActiveUser(doc.user);

      return issueTokenPair({
        userId: doc.user,
        clientId: client.client_id,
        clientName: client.client_name,
        scopes: granted,
        resource: doc.resource
      });
    },

    // Accepts OAuth access tokens and PATs. Refresh tokens are rejected.
    async verifyAccessToken(token) {
      const now = new Date();
      const doc = await ApiToken.findOne({
        tokenHash: hashSecret(token),
        kind: { $in: ['oauth_access', 'pat'] }
      });
      if (!doc || doc.revokedAt || (doc.expiresAt && doc.expiresAt <= now)) {
        throw new InvalidTokenError('Invalid or expired token');
      }
      const user = await User.findById(doc.user);
      if (!isActiveUser(user)) throw new InvalidTokenError('Invalid or expired token');

      if (!doc.lastUsedAt || now - doc.lastUsedAt > LAST_USED_RESOLUTION_MS) {
        await ApiToken.updateOne({ _id: doc._id }, { $set: { lastUsedAt: now } });
      }

      // requireBearerAuth insists on an expiry; PATs without one get a
      // nominal hour (they are re-checked on every request anyway).
      const expiresAt = doc.expiresAt || new Date(now.getTime() + ACCESS_TTL_MS);
      return {
        token,
        clientId: doc.clientId || 'pat',
        scopes: doc.scopes,
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
        extra: {
          userId: user._id.toString(),
          tokenId: doc._id.toString(),
          kind: doc.kind,
          clientName: doc.name || doc.clientId || 'pat'
        }
      };
    },

    async revokeToken(client, { token }) {
      const doc = await ApiToken.findOneAndUpdate(
        { tokenHash: hashSecret(token), clientId: client.client_id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      // Revoking a refresh token ends the whole connection (RFC 7009 2.1).
      if (doc && doc.kind === 'oauth_refresh') {
        await ApiToken.updateMany(
          { user: doc.user, clientId: client.client_id, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
      }
    },

    // Used by the consent POST once the user approves.
    async createAuthorizationCode({ pending, userId }) {
      const code = randomSecret();
      await OAuthCode.create({
        codeHash: hashSecret(code),
        clientId: pending.clientId,
        user: userId,
        scopes: pending.scopes,
        codeChallenge: pending.codeChallenge,
        redirectUri: pending.redirectUri,
        resource: pending.resource,
        expiresAt: new Date(Date.now() + CODE_TTL_MS)
      });
      return code;
    }
  };
}

function isPendingFresh(pending) {
  return Boolean(pending && pending.createdAt && Date.now() - pending.createdAt < PENDING_TTL_MS);
}

module.exports = { createProvider, clientsStore, isPendingFresh, isActiveUser, CONSENT_PATH, LOGIN_PATH };
