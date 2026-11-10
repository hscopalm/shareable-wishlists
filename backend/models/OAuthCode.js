const mongoose = require('mongoose');

// A short-lived, single-use OAuth authorization code. Only the sha256 hash of
// the code is stored. Redeeming deletes the document atomically.
const oauthCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scopes: { type: [String], default: [] },
  codeChallenge: { type: String, required: true },
  redirectUri: { type: String, required: true },
  resource: String,
  expiresAt: { type: Date, required: true }
});

// Mongo removes expired codes in the background; lookups also filter on
// expiresAt so an expired code is never accepted before the sweep runs.
oauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OAuthCode', oauthCodeSchema);
