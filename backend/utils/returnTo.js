// Post-login return path. Only the OAuth flow sets req.session.returnTo, and
// only same-site paths under /api/oauth/ are honoured so it can never become
// an open redirect.
const PREFIX = '/api/oauth/';

function isSafeReturnTo(value) {
  return typeof value === 'string'
    && value.startsWith(PREFIX)
    && value.length < 512
    && !value.includes('..')
    && !value.includes('\\')
    && !/[\s\0]/.test(value)
    && !value.slice(1).includes('//');
}

// Read and clear the session's return path. Returns null when unset or unsafe.
function takeReturnTo(req) {
  const value = req.session && req.session.returnTo;
  if (req.session) delete req.session.returnTo;
  return isSafeReturnTo(value) ? value : null;
}

module.exports = { isSafeReturnTo, takeReturnTo };
