// Pure functions for cash-item payment handles. Stores cleaned handles
// (no @ / $ / whitespace); builds profile URLs at read time so this file
// owns the URL templates.

const PROVIDERS = {
  venmo:   { urlTemplate: 'https://venmo.com/u/{handle}', handleRegex: /^[A-Za-z0-9_-]{1,30}$/ },
  paypal:  { urlTemplate: 'https://paypal.me/{handle}',   handleRegex: /^[A-Za-z0-9]{1,20}$/ },
  cashapp: { urlTemplate: 'https://cash.app/${handle}',   handleRegex: /^[A-Za-z][A-Za-z0-9_-]{0,19}$/ }
};

const PROVIDER_IDS = Object.keys(PROVIDERS);

function sanitizeHandle(provider, raw) {
  const def = PROVIDERS[provider];
  if (!def) return null;
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim().replace(/^[@$]+/, '');
  if (!trimmed) return null;
  if (!def.handleRegex.test(trimmed)) return null;
  return trimmed;
}

function buildProfileUrl(provider, handle) {
  const def = PROVIDERS[provider];
  if (!def || !handle) return null;
  return def.urlTemplate.replace('{handle}', handle);
}

// Take raw paymentLinks from a request body, return { sanitized } where
// sanitized has only valid non-empty handles.
function sanitizePaymentLinks(raw) {
  const sanitized = {};
  if (!raw || typeof raw !== 'object') return { sanitized };
  for (const id of PROVIDER_IDS) {
    const clean = sanitizeHandle(id, raw[id]);
    if (clean) sanitized[id] = clean;
  }
  return { sanitized };
}

function hasAnyHandle(paymentLinks) {
  if (!paymentLinks) return false;
  return PROVIDER_IDS.some(id => !!paymentLinks[id]);
}

function buildPaymentUrls(paymentLinks) {
  const urls = {};
  if (!paymentLinks) return urls;
  for (const id of PROVIDER_IDS) {
    const handle = paymentLinks[id];
    if (handle) urls[id] = buildProfileUrl(id, handle);
  }
  return urls;
}

module.exports = {
  sanitizeHandle,
  buildProfileUrl,
  sanitizePaymentLinks,
  hasAnyHandle,
  buildPaymentUrls
};
