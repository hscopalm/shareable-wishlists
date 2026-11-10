const { ServiceError } = require('../services/errors');

// Map an error thrown by a service to an HTTP response. Typed service errors
// keep their own status and body; anything else uses the route's fallback
// (status, optional fixed message, optional console.error label).
function sendError(res, err, { status = 500, message, log } = {}) {
  if (err instanceof ServiceError) {
    return res.status(err.status).json({ message: err.message, ...err.extra });
  }
  if (log) console.error(log, err);
  return res.status(status).json({ message: message || err.message });
}

module.exports = { sendError };
