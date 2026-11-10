// Node 18 has no globalThis.crypto inside Jest's sandbox, and the MCP SDK's
// pkce-challenge dependency then falls back to a dynamic import() that Jest
// rejects. Production runs Node 20, which has it; this keeps Node 18 working.
if (!globalThis.crypto) {
  globalThis.crypto = require('node:crypto').webcrypto;
}
