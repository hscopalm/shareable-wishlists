const mongoose = require('mongoose');

// An OAuth client registered through Dynamic Client Registration
// (/api/oauth/register). Public clients (token_endpoint_auth_method "none")
// have no secret. Confidential clients get a secret that is returned once at
// registration; only its sha256 hash is stored.
const oauthClientSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  clientSecretHash: String,
  clientSecretExpiresAt: Number, // seconds since epoch, 0 or absent = never
  clientIdIssuedAt: Number,
  clientName: String,
  redirectUris: { type: [String], required: true },
  // Remaining RFC 7591 metadata as registered (never includes the secret).
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OAuthClient', oauthClientSchema);
