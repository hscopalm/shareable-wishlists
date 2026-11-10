const mongoose = require('mongoose');

// Bearer tokens for the MCP endpoint: OAuth access and refresh tokens and
// personal access tokens (PATs) share this model. Only the sha256 hash of the
// token is stored; `prefix` is the first few characters, kept for display.
const apiTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  prefix: { type: String, required: true },
  kind: {
    type: String,
    enum: ['oauth_access', 'oauth_refresh', 'pat'],
    required: true
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: String, // OAuth tokens only
  scopes: { type: [String], default: [] },
  // PAT name chosen by the user, or the OAuth client's name.
  name: String,
  resource: String,
  lastUsedAt: Date,
  expiresAt: Date, // absent = never (PATs)
  revokedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

// Expired OAuth tokens are swept by Mongo. PATs without expiresAt are kept.
apiTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ApiToken', apiTokenSchema);
