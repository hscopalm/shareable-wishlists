// MCP tool registry.
//
// Pattern for adding a tool:
//   1. Define it in a module under mcp/tools/ (group by domain: lists.js,
//      items.js, sharing.js, ...). Each module exports an array of tool
//      definitions:
//
//        {
//          name: 'get_list',
//          title: 'Get list',
//          description: 'Written for an LLM. Say where IDs come from.',
//          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
//          inputSchema: { listId: z.string().describe('List ID from list_my_lists') },
//          async handler(args, ctx) {
//            // ctx: { userId, scopes, clientId, clientName }
//            // Call services only (never routes). Run sanitizeForOwner on any
//            // list/items the viewer owns. Throw service errors freely.
//            return { text: 'one-line summary', data: { ... }, wishlistId };
//          }
//        }
//
//   2. Add the module to TOOL_MODULES below.
//
// runTool (registered around every handler) takes care of:
//   - scope: tools without readOnlyHint need the full `wishlists` scope
//   - errors: service errors become { isError: true } results with the
//     service message; unexpected errors are logged and reported generically
//   - audit: one ActivityLog `mcp_tool_call` row per call
//   - output: `data` is returned as structuredContent (must be an object) and
//     `text` as the human-readable content
// `openWorldHint: false` and `title` are added to annotations automatically.

const mongoose = require('mongoose');
const ActivityLog = require('../../models/ActivityLog');
const { ServiceError } = require('../../services/errors');
const { SCOPES } = require('../config');

const TOOL_MODULES = [
  require('./account'),
  require('./lists'),
  require('./claims')
];

const allTools = TOOL_MODULES.flat();

function errorResult(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function errorMessage(err, toolName) {
  if (err instanceof ServiceError) return err.message;
  if (err instanceof mongoose.Error.CastError) return `Invalid ${err.path === '_id' ? 'id' : err.path}`;
  if (err instanceof mongoose.Error.ValidationError) return err.message;
  console.error(`MCP tool ${toolName} failed:`, err);
  return `Unexpected error while running ${toolName}`;
}

function canRun(tool, scopes) {
  if (scopes.includes(SCOPES.FULL)) return true;
  return Boolean(tool.annotations.readOnlyHint) && scopes.includes(SCOPES.READ);
}

async function audit({ tool, ctx, ok, wishlistId }) {
  try {
    await ActivityLog.create({
      action: 'mcp_tool_call',
      causer: ctx.userId,
      wishlist: mongoose.isValidObjectId(wishlistId) ? wishlistId : undefined,
      page: 'mcp',
      details: { tool: tool.name, source: 'mcp', clientName: ctx.clientName, ok }
    });
  } catch (err) {
    console.error('Failed to write MCP audit log:', err.message);
  }
}

async function runTool(tool, args, ctx) {
  if (!canRun(tool, ctx.scopes)) {
    await audit({ tool, ctx, ok: false, wishlistId: args.listId });
    return errorResult(`${tool.name} requires the ${SCOPES.FULL} scope. This connection is read-only.`);
  }
  try {
    const result = await tool.handler(args, ctx);
    await audit({ tool, ctx, ok: true, wishlistId: result.wishlistId || args.listId });
    const out = { content: [{ type: 'text', text: result.text }] };
    if (result.data !== undefined) out.structuredContent = result.data;
    return out;
  } catch (err) {
    await audit({ tool, ctx, ok: false, wishlistId: args.listId });
    return errorResult(errorMessage(err, tool.name));
  }
}

function registerTools(server, ctx) {
  for (const tool of allTools) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema || {},
      annotations: { title: tool.title, openWorldHint: false, ...tool.annotations }
    }, args => runTool(tool, args || {}, ctx));
  }
}

module.exports = { registerTools, allTools, runTool };
