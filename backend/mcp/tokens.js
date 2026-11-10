const crypto = require('crypto');
const mongoose = require('mongoose');
const ApiToken = require('../models/ApiToken');
const { SUPPORTED_SCOPES } = require('./config');
const { NotFoundError, ValidationError } = require('../services/errors');

// Token format: gg_<kind>_<32 random bytes, base64url>. Only sha256 hashes
// are stored, so a database leak does not leak usable tokens.
const KIND_PREFIX = {
  oauth_access: 'at',
  oauth_refresh: 'rt',
  pat: 'pat'
};
const PREFIX_DISPLAY_LENGTH = 12;

function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Constant-time comparison of two strings (compares their hashes so the
// inputs may differ in length).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function randomSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function generateToken(kind) {
  const token = `gg_${KIND_PREFIX[kind]}_${randomSecret()}`;
  return { token, tokenHash: hashSecret(token), prefix: token.slice(0, PREFIX_DISPLAY_LENGTH) };
}

// Create and store a token. Returns { token, doc }; the plaintext token is
// never persisted.
async function issueToken({ kind, userId, clientId, scopes, name, resource, expiresAt }) {
  const { token, tokenHash, prefix } = generateToken(kind);
  const doc = await ApiToken.create({
    tokenHash, prefix, kind, user: userId, clientId, scopes, name, resource, expiresAt
  });
  return { token, doc };
}

// ---- Personal access tokens and connection management (session auth) ----

function patView(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    prefix: doc.prefix,
    scope: doc.scopes.join(' '),
    createdAt: doc.createdAt,
    lastUsedAt: doc.lastUsedAt || null,
    expiresAt: doc.expiresAt || null
  };
}

async function createPat({ userId, name, scope }) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed.length > 100) {
    throw new ValidationError('Token name is required (max 100 characters)');
  }
  if (!SUPPORTED_SCOPES.includes(scope)) {
    throw new ValidationError(`Scope must be one of: ${SUPPORTED_SCOPES.join(', ')}`);
  }
  const { token, doc } = await issueToken({ kind: 'pat', userId, scopes: [scope], name: trimmed });
  return { token, ...patView(doc) };
}

function activeFilter() {
  return {
    revokedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  };
}

// My PATs plus my OAuth connections grouped by client. Never returns secrets.
async function listTokens({ userId }) {
  const docs = await ApiToken.find({ user: userId, ...activeFilter() }).sort({ createdAt: -1 });

  const tokens = docs.filter(d => d.kind === 'pat').map(patView);

  const byClient = new Map();
  for (const d of docs) {
    if (d.kind === 'pat') continue;
    const c = byClient.get(d.clientId) || {
      clientId: d.clientId,
      clientName: d.name || d.clientId,
      scopes: new Set(),
      connectedAt: d.createdAt,
      lastUsedAt: null
    };
    d.scopes.forEach(s => c.scopes.add(s));
    if (d.createdAt < c.connectedAt) c.connectedAt = d.createdAt;
    if (d.lastUsedAt && (!c.lastUsedAt || d.lastUsedAt > c.lastUsedAt)) c.lastUsedAt = d.lastUsedAt;
    byClient.set(d.clientId, c);
  }
  const connections = [...byClient.values()].map(c => ({ ...c, scopes: [...c.scopes] }));

  return { tokens, connections };
}

async function revokePat({ userId, tokenId }) {
  if (!mongoose.isValidObjectId(tokenId)) throw new NotFoundError('Token not found');
  const doc = await ApiToken.findOneAndUpdate(
    { _id: tokenId, user: userId, kind: 'pat', revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (!doc) throw new NotFoundError('Token not found');
  return { message: 'Token revoked' };
}

async function revokeConnection({ userId, clientId }) {
  const result = await ApiToken.updateMany(
    { user: userId, clientId, kind: { $in: ['oauth_access', 'oauth_refresh'] }, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (result.modifiedCount === 0) throw new NotFoundError('Connection not found');
  return { message: 'Connection revoked', revoked: result.modifiedCount };
}

module.exports = {
  hashSecret,
  safeEqual,
  randomSecret,
  issueToken,
  createPat,
  listTokens,
  revokePat,
  revokeConnection
};
