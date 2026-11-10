const ActivityLog = require('../../../models/ActivityLog');
const Wishlist = require('../../../models/Wishlist');
const { setupMcpServer, mcpClientFor, callTool, createPat } = require('../../helpers/mcp');
const { createTestUsers } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');

setupMcpServer();

let alice; // owner
let bob; // friend the list is shared with
let charlie; // second friend / stranger

beforeEach(async () => {
  ({ alice, bob, charlie } = await createTestUsers());
});

async function sharedList(sharedWith = [bob]) {
  return createWishlist(alice, {
    name: 'Alice Birthday',
    sharedWith: sharedWith.map(u => u._id),
    items: [
      { title: 'Single Gift', price: 20, priority: 4 },
      { title: 'Socks', quantity: 3 },
      { title: 'Honeymoon Fund', type: 'cash', paymentLinks: { venmo: 'alice' } }
    ]
  });
}

function ids(list) {
  return {
    listId: list._id.toString(),
    single: list.items[0]._id.toString(),
    multi: list.items[1]._id.toString(),
    cash: list.items[2]._id.toString()
  };
}

async function clientFor(user, scope) {
  return mcpClientFor(await createPat(user, scope));
}

describe('whoami', () => {
  it('reports the user and scope', async () => {
    const res = await callTool(await clientFor(alice, 'wishlists:read'), 'whoami');
    expect(res.structuredContent).toMatchObject({ email: alice.email, name: alice.name, scopes: ['wishlists:read'] });
    expect(res.content[0].text).toContain(alice.email);
  });
});

describe('owner spoiler protection', () => {
  async function listClaimedByBob() {
    const list = await sharedList();
    const { listId, single, multi, cash } = ids(list);
    const bobClient = await clientFor(bob);
    for (const [itemId, quantity] of [[single, undefined], [multi, 2], [cash, undefined]]) {
      const res = await callTool(bobClient, 'claim_item', { listId, itemId, ...(quantity ? { quantity } : {}) });
      expect(res.isError).toBeFalsy();
    }
    return list;
  }

  function expectNoClaimData(result) {
    const json = JSON.stringify(result);
    for (const leak of [bob.name, bob.email, bob._id.toString(), 'claim', 'Claim', '"status"', 'byMe']) {
      expect(json).not.toContain(leak);
    }
  }

  it('get_list shows the owner no claimer identity or claimed state', async () => {
    const list = await listClaimedByBob();
    const res = await callTool(await clientFor(alice), 'get_list', { listId: list._id.toString() });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.isOwner).toBe(true);
    expect(res.structuredContent.items).toHaveLength(3);
    expectNoClaimData(res);
  });

  it('list_my_lists shows the owner no claim data', async () => {
    await listClaimedByBob();
    const res = await callTool(await clientFor(alice), 'list_my_lists');
    expect(res.structuredContent.lists).toHaveLength(1);
    expect(res.structuredContent.lists[0]).toMatchObject({ name: 'Alice Birthday', itemCount: 3, sharedWithCount: 1 });
    expectNoClaimData(res);
  });

  it('shared viewers do see claims', async () => {
    const list = await sharedList([bob, charlie]);
    const { listId, single, multi } = ids(list);
    await callTool(await clientFor(bob), 'claim_item', { listId, itemId: single });
    await callTool(await clientFor(charlie), 'claim_item', { listId, itemId: multi, quantity: 2 });

    const res = await callTool(await clientFor(bob), 'get_list', { listId });
    expect(res.structuredContent.isOwner).toBe(false);
    const [singleItem, multiItem] = res.structuredContent.items;
    expect(singleItem).toMatchObject({ claimedByMe: true, fullyClaimed: true });
    expect(singleItem.claims).toEqual([expect.objectContaining({ by: bob.name, byMe: true, quantity: 1 })]);
    expect(multiItem).toMatchObject({ claimedByMe: false, claimedQuantity: 2, fullyClaimed: false });
    expect(multiItem.claims[0]).toMatchObject({ by: charlie.name, byMe: false });
    expect(res.content[0].text).toContain('[claimed by you]');
  });
});

describe('get_list authorization and errors', () => {
  it('returns a tool error for a stranger', async () => {
    const list = await sharedList();
    const res = await callTool(await clientFor(charlie), 'get_list', { listId: list._id.toString() });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('List not found');
  });

  it('returns a tool error for a malformed id', async () => {
    const res = await callTool(await clientFor(alice), 'get_list', { listId: 'not-an-id' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Invalid id');
  });

  it('strips Mongo noise from output', async () => {
    const list = await sharedList();
    const res = await callTool(await clientFor(bob), 'get_list', { listId: list._id.toString() });
    const json = JSON.stringify(res.structuredContent);
    expect(json).not.toContain('"_id"');
    expect(json).not.toContain('__v');
    expect(res.structuredContent.list).toMatchObject({ id: list._id.toString(), owner: { name: alice.name } });
  });
});

describe('claim_item', () => {
  it('claims an item and is idempotent on repeat', async () => {
    const list = await sharedList();
    const { listId, single } = ids(list);
    const client = await clientFor(bob);

    const first = await callTool(client, 'claim_item', { listId, itemId: single });
    expect(first.isError).toBeFalsy();
    expect(first.structuredContent.item).toMatchObject({ title: 'Single Gift', claimedByMe: true });

    const second = await callTool(client, 'claim_item', { listId, itemId: single });
    expect(second.isError).toBeFalsy();
    const stored = await Wishlist.findById(listId);
    expect(stored.items[0].status.claimedBy.toString()).toBe(bob._id.toString());
  });

  it('maps a conflict to a tool error', async () => {
    const list = await sharedList([bob, charlie]);
    const { listId, single } = ids(list);
    await callTool(await clientFor(bob), 'claim_item', { listId, itemId: single });
    const res = await callTool(await clientFor(charlie), 'claim_item', { listId, itemId: single });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Item already claimed by someone else');
  });

  it('does not let the owner claim on their own list', async () => {
    const list = await sharedList();
    const { listId, single } = ids(list);
    const res = await callTool(await clientFor(alice), 'claim_item', { listId, itemId: single });
    expect(res.isError).toBe(true);
    const stored = await Wishlist.findById(listId);
    expect(stored.items[0].status.claimedBy).toBeUndefined();
  });

  it('lets exactly one of two concurrent claims on a single item succeed', async () => {
    const list = await sharedList([bob, charlie]);
    const { listId, single } = ids(list);
    const [bobClient, charlieClient] = await Promise.all([clientFor(bob), clientFor(charlie)]);

    const results = await Promise.all([
      callTool(bobClient, 'claim_item', { listId, itemId: single }),
      callTool(charlieClient, 'claim_item', { listId, itemId: single })
    ]);
    expect(results.filter(r => !r.isError)).toHaveLength(1);
    expect(results.filter(r => r.isError)).toHaveLength(1);

    const winner = results[0].isError ? charlie : bob;
    const stored = await Wishlist.findById(listId);
    expect(stored.items[0].status.claimedBy.toString()).toBe(winner._id.toString());
  });

  it('is blocked for read-only tokens without touching the item', async () => {
    const list = await sharedList();
    const { listId, single } = ids(list);
    const res = await callTool(await clientFor(bob, 'wishlists:read'), 'claim_item', { listId, itemId: single });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/requires the wishlists scope/);
    const stored = await Wishlist.findById(listId);
    expect(stored.items[0].status.claimedBy).toBeUndefined();
  });
});

describe('audit log', () => {
  it('records each tool call with tool, client, outcome and list', async () => {
    const list = await sharedList();
    const client = await clientFor(bob);
    await callTool(client, 'get_list', { listId: list._id.toString() });
    await callTool(client, 'get_list', { listId: 'nope' });

    const logs = await ActivityLog.find({ action: 'mcp_tool_call' }).sort({ createdAt: 1, _id: 1 }).lean();
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      causer: bob._id,
      wishlist: list._id,
      page: 'mcp',
      details: { tool: 'get_list', source: 'mcp', clientName: 'test token', ok: true }
    });
    expect(logs[1].details.ok).toBe(false);
    expect(logs[1].wishlist).toBeUndefined();
  });
});
