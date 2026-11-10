const Wishlist = require('../../../models/Wishlist');
const ApiToken = require('../../../models/ApiToken');
const { allTools } = require('../../../mcp/tools');
const { setupMcpServer, mcpClientFor, callTool, createPat, loginAgent } = require('../../helpers/mcp');
const { createTestUsers } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');

const mcp = setupMcpServer();

let alice;
let bob;

beforeEach(async () => {
  ({ alice, bob } = await createTestUsers());
});

describe('tools/list', () => {
  it('lists every registered tool with a description, annotations and described inputs', async () => {
    const client = await mcpClientFor(await createPat(alice));
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(allTools.map(t => t.name).sort());
    expect(tools.length).toBeGreaterThanOrEqual(21);

    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.annotations).toMatchObject({ openWorldHint: false });
      expect(typeof tool.annotations.readOnlyHint).toBe('boolean');
      expect(typeof tool.annotations.destructiveHint).toBe('boolean');
      for (const [prop, schema] of Object.entries(tool.inputSchema.properties || {})) {
        if (!schema.description) throw new Error(`${tool.name}.${prop} has no description`);
      }
    }
  });

  it('marks the delete and unshare tools destructive', async () => {
    const client = await mcpClientFor(await createPat(alice));
    const { tools } = await client.listTools();
    const destructive = tools.filter(t => t.annotations.destructiveHint).map(t => t.name).sort();
    expect(destructive).toEqual(['delete_item', 'delete_list', 'unshare_list']);
  });
});

describe('read-only tokens', () => {
  // Valid arguments for every tool. A new tool without an entry fails the
  // first assertion, so it cannot skip the read-only check.
  function sampleArgs(list) {
    const listId = list._id.toString();
    const itemId = list.items[0]._id.toString();
    return {
      whoami: {},
      list_my_lists: {},
      get_list: { listId },
      list_shared_with_me: {},
      list_shared_users: { listId },
      get_invite_link: { listId },
      get_my_claims: {},
      create_list: { name: 'New' },
      update_list: { listId, name: 'Renamed' },
      delete_list: { listId },
      add_item: { listId, title: 'New item' },
      update_item: { itemId, title: 'Renamed' },
      delete_item: { itemId },
      share_list: { listId, email: 'new@test.com' },
      unshare_list: { listId, userId: bob._id.toString() },
      create_invite_link: { listId },
      disable_invite_link: { listId },
      set_anonymous_claims: { listId, allow: true },
      claim_item: { listId, itemId },
      unclaim_item: { listId, itemId },
      join_via_invite_link: { link: 'sometoken' }
    };
  }

  it('blocks get_invite_link because the live token grants access', async () => {
    const list = await createWishlist(alice, { items: [{ title: 'Gift' }] });
    const client = await mcpClientFor(await createPat(alice, 'wishlists:read'));
    const res = await callTool(client, 'get_invite_link', { listId: list._id.toString() });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/requires the wishlists scope/);
  });

  it('lets read tools run and blocks every write tool', async () => {
    const list = await createWishlist(alice, { sharedWith: [bob._id], items: [{ title: 'Gift' }] });
    const args = sampleArgs(list);
    expect(Object.keys(args).sort()).toEqual(allTools.map(t => t.name).sort());

    const client = await mcpClientFor(await createPat(alice, 'wishlists:read'));
    for (const tool of allTools) {
      const res = await callTool(client, tool.name, args[tool.name]);
      if (tool.annotations.readOnlyHint) {
        if (res.isError) throw new Error(`${tool.name} failed: ${res.content[0].text}`);
      } else {
        expect(res.isError).toBe(true);
        expect(res.content[0].text).toMatch(/requires the wishlists scope/);
      }
    }

    const stored = await Wishlist.find({});
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: 'Test Wishlist', inviteLinkEnabled: false });
    expect(stored[0].items).toHaveLength(1);
    expect(stored[0].sharedWith).toHaveLength(1);
  });
});

// The /connect page reads these fields; renaming one breaks it silently.
describe('GET /api/mcp-tokens contract', () => {
  it('returns tokens with scopes and connections with client details', async () => {
    await createPat(alice, 'wishlists:read');
    await ApiToken.create({
      tokenHash: 'hash-access', prefix: 'gg_a_x', kind: 'oauth_access', user: alice._id,
      clientId: 'client-1', name: 'Some Assistant', scopes: ['wishlists'],
      lastUsedAt: new Date(), expiresAt: new Date(Date.now() + 3600 * 1000)
    });

    const agent = await loginAgent(mcp.app, alice);
    const res = await agent.get('/api/mcp-tokens').expect(200);

    expect(res.body.tokens).toHaveLength(1);
    expect(res.body.tokens[0]).toMatchObject({ scopes: ['wishlists:read'] });
    expect(res.body.tokens[0]).toEqual(expect.objectContaining({
      id: expect.any(String), name: 'test token', prefix: expect.any(String)
    }));
    expect(res.body.tokens[0]).toHaveProperty('lastUsedAt');
    expect(JSON.stringify(res.body)).not.toContain('hash-access');

    expect(res.body.connections).toEqual([expect.objectContaining({
      clientId: 'client-1',
      clientName: 'Some Assistant',
      scopes: ['wishlists'],
      lastUsedAt: expect.any(String)
    })]);
  });
});
