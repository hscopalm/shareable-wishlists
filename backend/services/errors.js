// Typed errors thrown by the service layer. Each carries the HTTP status the
// REST routes have always returned for that situation, plus optional extra
// fields merged into the JSON body next to `message`.
class ServiceError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.extra = extra || {};
  }
}

class NotFoundError extends ServiceError {
  constructor(message = 'Not found', extra) { super(404, message, extra); }
}

class ForbiddenError extends ServiceError {
  constructor(message = 'Forbidden', extra) { super(403, message, extra); }
}

class ValidationError extends ServiceError {
  constructor(message = 'Invalid request', extra) { super(400, message, extra); }
}

class UnauthorizedError extends ServiceError {
  constructor(message = 'Sign in required', extra) { super(401, message, extra); }
}

// Claim conflicts ("already claimed", "capacity exceeded") have always been
// returned as 400 by the REST API, so the claim code passes status 400 to keep
// the wire behaviour identical. The default is the semantically right 409.
class ConflictError extends ServiceError {
  constructor(message = 'Conflict', extra, status = 409) { super(status, message, extra); }
}

module.exports = {
  ServiceError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
};
