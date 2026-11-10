jest.mock('../../../utils/emailService');

const Wishlist = require('../../../models/Wishlist');
const { sendEmail } = require('../../../utils/emailService');
const { setupMcpServer, mcpClientFor, callTool, createPat } = require('../../helpers/mcp');
const { createTestUsers } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');

setupMcpServer();

let alice; // owner
let bob; // friend
let charlie; // stranger

beforeEach(async () => {
  jest.clearAllMocks();
  ({ alice, bob, charlie } = await createTestUsers());
});

async function clientFor(user, scope) {
  return mcpClientFor(await createPat(user, scope));
}

async function ok(client, name, args) {
  const res = await callTool(client, name, args);
  if (res.isError) throw new Error(`${name} failed: ${res.content[0].text}`);
  return res;
}

function sharedList(sharedWith = [bob]) {
  return createWishlist(alice, {
    name: 'Alice Birthday',
    sharedWith: sharedWith.map(u => u._id),
    items: [{ title: 'Single Gift' }, { title: 'Socks', quantity: 3 }]
  });
}

describe('lists', () => {
  it('creates, updates (keeping untouched fields) and deletes a list', async () => {
    const client = await clientFor(alice);
    const created = await ok(client, 'create_list', { name: 'Xmas', description: 'Winter', event_date: '2026-12-25' });
    const listId = created.structuredContent.list.id;
    expect(created.structuredContent.list).toMatchObject({ name: 'Xmas', description: 'Winter', itemCount: 0 });

    const updated = await ok(client, 'update_list', { listId, name: 'Christmas' });
    expect(updated.structuredContent.list).toMatchObject({ name: 'Christmas', description: 'Winter' });
    const stored = await Wishlist.findById(listId);
    expect(stored.event_date.toISOString()).toContain('2026-12-25');

    await ok(client, 'delete_list', { listId });
    expect(await Wishlist.findById(listId)).toBeNull();
  });

  it('maps bad and unknown ids to tool errors', async () => {
    const client = await clientFor(alice);
    const bad = await callTool(client, 'delete_list', { listId: 'nope' });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toBe('Invalid id');
    const missing = await callTool(client, 'update_list', { listId: '64b7f0f2f0f0f0f0f0f0f0f0', name: 'x' });
    expect(missing).toMatchObject({ isError: true, content: [{ text: 'List not found' }] });
  });
});

describe('items', () => {
  it('adds a gift with every field, updates it and deletes it', async () => {
    const client = await clientFor(alice);
    const list = await createWishlist(alice, {});
    const listId = list._id.toString();

    const added = await ok(client, 'add_item', {
      listId, title: 'Lamp', description: 'Desk lamp', link: 'https://example.com/lamp',
      imageUrl: 'https://example.com/lamp.jpg', notes: 'Black', price: 39.5, priority: 4, quantity: 2
    });
    const item = added.structuredContent.item;
    expect(item).toMatchObject({
      type: 'gift', title: 'Lamp', description: 'Desk lamp', link: 'https://example.com/lamp',
      imageUrl: 'https://example.com/lamp.jpg', notes: 'Black', price: 39.5, priority: 4, quantity: 2
    });

    const updated = await ok(client, 'update_item', { itemId: item.id, title: 'Big Lamp', priority: 5 });
    expect(updated.structuredContent.item).toMatchObject({ title: 'Big Lamp', priority: 5, price: 39.5, quantity: 2 });

    await ok(client, 'delete_item', { itemId: item.id });
    expect((await Wishlist.findById(listId)).items).toHaveLength(0);
  });

  it('adds and updates a cash item, and rejects one without payment handles', async () => {
    const client = await clientFor(alice);
    const list = await createWishlist(alice, {});
    const listId = list._id.toString();

    const missing = await callTool(client, 'add_item', { listId, type: 'cash', title: 'Fund' });
    expect(missing).toMatchObject({ isError: true, content: [{ text: 'At least one payment handle is required' }] });

    const added = await ok(client, 'add_item', { listId, type: 'cash', title: 'Fund', paymentLinks: { venmo: 'alice' } });
    expect(added.structuredContent.item).toMatchObject({ type: 'cash', paymentLinks: { venmo: 'alice' } });

    const updated = await ok(client, 'update_item', {
      itemId: added.structuredContent.item.id, paymentLinks: { paypal: 'alice' }
    });
    expect(updated.structuredContent.item.paymentLinks).toEqual({ paypal: 'alice' });
  });

  it('maps bad and unknown item ids to tool errors', async () => {
    const client = await clientFor(alice);
    const bad = await callTool(client, 'delete_item', { itemId: 'nope' });
    expect(bad.isError).toBe(true);
    const missing = await callTool(client, 'update_item', { itemId: '64b7f0f2f0f0f0f0f0f0f0f0', title: 'x' });
    expect(missing).toMatchObject({ isError: true, content: [{ text: 'Item not found' }] });
  });
});

describe('authorization parity', () => {
  it('stops a shared user from changing someone else\'s list', async () => {
    const list = await sharedList();
    const listId = list._id.toString();
    const itemId = list.items[0]._id.toString();
    const client = await clientFor(bob);

    const attempts = [
      ['update_list', { listId, name: 'Hacked' }],
      ['delete_list', { listId }],
      ['add_item', { listId, title: 'Sneaky' }],
      ['update_item', { itemId, title: 'Hacked' }],
      ['delete_item', { itemId }],
      ['share_list', { listId, email: 'x@test.com' }],
      ['create_invite_link', { listId }]
    ];
    for (const [name, args] of attempts) {
      const res = await callTool(client, name, args);
      expect([name, res.isError]).toEqual([name, true]);
      expect(res.content[0].text).toMatch(/not found/i);
    }

    const stored = await Wishlist.findById(listId);
    expect(stored.name).toBe('Alice Birthday');
    expect(stored.items.map(i => i.title)).toEqual(['Single Gift', 'Socks']);
    expect(stored.sharedWith).toHaveLength(1);
    expect(stored.inviteToken).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('stops a stranger from reading or claiming', async () => {
    const list = await sharedList();
    const listId = list._id.toString();
    const client = await clientFor(charlie);
    expect((await callTool(client, 'get_list', { listId })).isError).toBe(true);
    const claim = await callTool(client, 'claim_item', { listId, itemId: list.items[0]._id.toString() });
    expect(claim.isError).toBe(true);
    expect((await Wishlist.findById(listId)).items[0].status.claimedBy).toBeUndefined();
  });
});

describe('owner spoiler protection on write tools', () => {
  it('shows no claim data in add_item, update_item, create_list and update_list responses', async () => {
    const list = await sharedList();
    const listId = list._id.toString();
    const [single, multi] = list.items.map(i => i._id.toString());
    const bobClient = await clientFor(bob);
    await ok(bobClient, 'claim_item', { listId, itemId: single });
    await ok(bobClient, 'claim_item', { listId, itemId: multi, quantity: 2 });

    const client = await clientFor(alice);
    const results = [
      await ok(client, 'add_item', { listId, title: 'Another' }),
      await ok(client, 'update_item', { itemId: single, title: 'Single Gift 2', notes: 'n' }),
      await ok(client, 'update_item', { itemId: multi, quantity: 1 }), // multi to single with a claim: service warns about claims
      await ok(client, 'update_item', { itemId: multi, quantity: 5 }),
      await ok(client, 'update_list', { listId, description: 'updated' }),
      await ok(client, 'create_list', { name: 'Fresh' })
    ];
    for (const res of results) {
      const json = JSON.stringify(res);
      for (const leak of [bob.name, bob.email, bob._id.toString(), 'claim', 'Claim', '"status"', 'byMe', 'warning']) {
        expect(json).not.toContain(leak);
      }
    }
  });
});

describe('sharing', () => {
  it('shares by email, lists, and unshares', async () => {
    const list = await createWishlist(alice, {});
    const listId = list._id.toString();
    const client = await clientFor(alice);

    const shared = await ok(client, 'share_list', { listId, email: 'Bob@Test.com' });
    expect(shared.structuredContent.sharedWith).toMatchObject({ email: 'bob@test.com' });

    const users = await ok(client, 'list_shared_users', { listId });
    expect(users.structuredContent.users).toEqual([expect.objectContaining({ id: bob._id.toString(), email: bob.email })]);

    const bobLists = await ok(await clientFor(bob), 'list_shared_with_me');
    expect(bobLists.structuredContent.lists).toEqual([
      expect.objectContaining({ id: listId, owner: expect.objectContaining({ name: alice.name }) })
    ]);

    await ok(client, 'unshare_list', { listId, userId: bob._id.toString() });
    expect((await ok(client, 'list_shared_users', { listId })).structuredContent.users).toEqual([]);
    expect((await ok(await clientFor(bob), 'list_shared_with_me')).structuredContent.lists).toEqual([]);
  });

  it('returns tool errors for bad emails and duplicates', async () => {
    const list = await createWishlist(alice, { sharedWith: [bob._id] });
    const client = await clientFor(alice);
    const listId = list._id.toString();
    expect((await callTool(client, 'share_list', { listId, email: 'nope' })).isError).toBe(true);
    const dup = await callTool(client, 'share_list', { listId, email: bob.email });
    expect(dup.content[0].text).toBe('List already shared with this user');
  });

  it('emails by default and skips the email with notify false', async () => {
    const list = await createWishlist(alice, {});
    const listId = list._id.toString();
    const client = await clientFor(alice);

    await ok(client, 'share_list', { listId, email: 'quiet@test.com', notify: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect((await Wishlist.findById(listId)).sharedWith).toHaveLength(1);

    await ok(client, 'share_list', { listId, email: 'loud@test.com' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('limits share_list to 20 per hour per user', async () => {
    const list = await createWishlist(alice, {});
    const listId = list._id.toString();
    const client = await clientFor(alice);
    for (let i = 0; i < 20; i++) {
      await ok(client, 'share_list', { listId, email: `friend${i}@test.com`, notify: false });
    }
    const blocked = await callTool(client, 'share_list', { listId, email: 'friend21@test.com', notify: false });
    expect(blocked.isError).toBe(true);
    expect(blocked.content[0].text).toMatch(/Share limit reached/);
    expect((await Wishlist.findById(listId)).sharedWith).toHaveLength(20);

    // Another user is unaffected.
    const other = await createWishlist(bob, {});
    await ok(await clientFor(bob), 'share_list', { listId: other._id.toString(), email: 'x@test.com', notify: false });
  });
});

describe('invite links', () => {
  it('creates, reads, regenerates, disables and configures anonymous claims', async () => {
    const list = await createWishlist(alice, {});
    const listId = list._id.toString();
    const client = await clientFor(alice);

    expect((await ok(client, 'get_invite_link', { listId })).structuredContent.link).toBeNull();

    const first = (await ok(client, 'create_invite_link', { listId })).structuredContent;
    expect(first.link).toContain(`/invite/${first.token}`);
    expect((await ok(client, 'get_invite_link', { listId })).structuredContent).toMatchObject({ enabled: true, token: first.token });

    const second = (await ok(client, 'create_invite_link', { listId })).structuredContent;
    expect(second.token).not.toBe(first.token);

    expect((await ok(client, 'set_anonymous_claims', { listId, allow: true })).structuredContent.allowAnonymousClaims).toBe(true);
    await ok(client, 'disable_invite_link', { listId });
    expect((await ok(client, 'get_invite_link', { listId })).structuredContent.enabled).toBe(false);
  });

  it('describes create_invite_link as invalidating the previous link', async () => {
    const { tools } = await (await clientFor(alice)).listTools();
    expect(tools.find(t => t.name === 'create_invite_link').description).toMatch(/invalidates the previous link/);
  });

  it('lets a joiner use a full URL or a bare token, then claim', async () => {
    const list = await sharedList([]);
    const listId = list._id.toString();
    const aliceClient = await clientFor(alice);
    const { token, link } = (await ok(aliceClient, 'create_invite_link', { listId })).structuredContent;

    const bobClient = await clientFor(bob);
    const joined = await ok(bobClient, 'join_via_invite_link', { link });
    expect(joined.structuredContent.listId).toBe(listId);
    await ok(bobClient, 'claim_item', { listId, itemId: list.items[0]._id.toString() });

    const charlieClient = await clientFor(charlie);
    await ok(charlieClient, 'join_via_invite_link', { link: token });
    expect((await ok(charlieClient, 'list_shared_with_me')).structuredContent.lists).toHaveLength(1);
  });

  it('rejects disabled links and the owner joining their own list', async () => {
    const list = await sharedList([]);
    const listId = list._id.toString();
    const aliceClient = await clientFor(alice);
    const { link } = (await ok(aliceClient, 'create_invite_link', { listId })).structuredContent;

    const own = await callTool(aliceClient, 'join_via_invite_link', { link });
    expect(own).toMatchObject({ isError: true, content: [{ text: 'You own this list' }] });

    await ok(aliceClient, 'disable_invite_link', { listId });
    const res = await callTool(await clientFor(bob), 'join_via_invite_link', { link });
    expect(res).toMatchObject({ isError: true, content: [{ text: 'Invite link not found or disabled' }] });
  });
});

describe('unclaim_item and get_my_claims', () => {
  it('unclaims after claiming, and tracks quantity', async () => {
    const list = await sharedList();
    const listId = list._id.toString();
    const [single, multi] = list.items.map(i => i._id.toString());
    const client = await clientFor(bob);

    await ok(client, 'claim_item', { listId, itemId: single });
    await ok(client, 'claim_item', { listId, itemId: multi, quantity: 2 });

    let mine = (await ok(client, 'get_my_claims')).structuredContent.lists;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ listId, listName: 'Alice Birthday', owner: { name: alice.name } });
    expect(mine[0].items.map(i => [i.title, i.myQuantity])).toEqual([['Single Gift', 1], ['Socks', 2]]);

    const res = await ok(client, 'unclaim_item', { listId, itemId: single });
    expect(res.structuredContent.item).toMatchObject({ claimedByMe: false, claimedQuantity: 0 });
    expect((await Wishlist.findById(listId)).items[0].status.claimedBy).toBeUndefined();

    // Repeating is a no-op, not a re-claim.
    await ok(client, 'unclaim_item', { listId, itemId: single });
    mine = (await ok(client, 'get_my_claims')).structuredContent.lists;
    expect(mine[0].items.map(i => i.title)).toEqual(['Socks']);

    await ok(client, 'unclaim_item', { listId, itemId: multi });
    expect((await ok(client, 'get_my_claims')).structuredContent.lists).toEqual([]);
  });

  it('drops claims from get_my_claims once the list is unshared', async () => {
    const list = await sharedList();
    const listId = list._id.toString();
    const bobClient = await clientFor(bob);
    await ok(bobClient, 'claim_item', { listId, itemId: list.items[0]._id.toString() });
    expect((await ok(bobClient, 'get_my_claims')).structuredContent.lists).toHaveLength(1);

    await ok(await clientFor(alice), 'unshare_list', { listId, userId: bob._id.toString() });
    expect((await ok(bobClient, 'get_my_claims')).structuredContent.lists).toEqual([]);
  });
});
