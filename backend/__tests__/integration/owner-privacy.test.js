const { loginAs } = require('../helpers/auth');
const { createTestUsers } = require('../fixtures/users');
const { createWishlistWithItems } = require('../fixtures/wishlists');

// Owners must never learn who claimed an item, or whether it was claimed,
// from any API response. Shared viewers still need full claim data.

async function claimedList(owner, [bob, charlie]) {
  return createWishlistWithItems(owner, [
    { title: 'Single', status: { claimedBy: bob._id, claimedAt: new Date() } },
    {
      title: 'Multi',
      quantity: 3,
      claims: [
        { claimedBy: bob._id, quantity: 1, claimedAt: new Date() },
        { claimedBy: charlie._id, quantity: 1, claimedAt: new Date() },
        { quantity: 1, claimedAt: new Date(), isAnonymousClaim: true, anonymousClaimerName: 'Guest Sarah' }
      ]
    }
  ], { sharedWith: [bob._id, charlie._id] });
}

function expectNoClaimData(item) {
  expect(item.claims).toEqual([]);
  expect(item.status?.claimedBy).toBeUndefined();
  expect(item.status?.claimedAt).toBeUndefined();
  expect(item.status?.isAnonymousClaim).toBeUndefined();
  expect(item.isClaimed).toBeUndefined();
}

describe('Owner claim privacy', () => {
  it('hides claim data from the owner on GET /api/lists/:id', async () => {
    const { alice, bob, charlie } = await createTestUsers();
    const wishlist = await claimedList(alice, [bob, charlie]);
    const agent = await loginAs(alice);

    const res = await agent.get(`/api/lists/${wishlist._id}`);

    expect(res.status).toBe(200);
    expect(res.body.isShared).toBe(false);
    expect(res.body.items).toHaveLength(2);
    res.body.items.forEach(expectNoClaimData);
    res.body.list.items.forEach(expectNoClaimData);

    // Shared users are listed in sharedWith, so check claim-specific values only.
    const raw = JSON.stringify(res.body.items) + JSON.stringify(res.body.list.items);
    expect(raw).not.toContain(bob.email);
    expect(raw).not.toContain(bob._id.toString());
    expect(raw).not.toContain(charlie._id.toString());
    expect(raw).not.toContain('Guest Sarah');
  });

  it('still shows claims to shared users on GET /api/lists/:id', async () => {
    const { alice, bob, charlie } = await createTestUsers();
    const wishlist = await claimedList(alice, [bob, charlie]);
    const agent = await loginAs(charlie);

    const res = await agent.get(`/api/lists/${wishlist._id}`);

    expect(res.status).toBe(200);
    expect(res.body.isShared).toBe(true);
    const single = res.body.items.find(i => i.title === 'Single');
    const multi = res.body.items.find(i => i.title === 'Multi');
    expect(single.status.claimedBy.name).toBe(bob.name);
    expect(single.claims).toHaveLength(1);
    expect(multi.claims).toHaveLength(3);
    expect(multi.claims.map(c => c.anonymousClaimerName)).toContain('Guest Sarah');
  });

  it('hides claim data from the owner on GET /api/lists and PUT /api/lists/:id', async () => {
    const { alice, bob, charlie } = await createTestUsers();
    const wishlist = await claimedList(alice, [bob, charlie]);
    const agent = await loginAs(alice);

    const index = await agent.get('/api/lists');
    expect(index.status).toBe(200);
    expect(index.body[0].items).toHaveLength(2);
    index.body[0].items.forEach(expectNoClaimData);

    const updated = await agent.put(`/api/lists/${wishlist._id}`).send({ name: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed');
    updated.body.items.forEach(expectNoClaimData);
  });

  it('hides claim data from the owner in item update responses', async () => {
    const { alice, bob, charlie } = await createTestUsers();
    const wishlist = await claimedList(alice, [bob, charlie]);
    const agent = await loginAs(alice);
    const [single, multi] = wishlist.items;

    const singleRes = await agent.put(`/api/wishlist/${single._id}`).send({ title: 'Single v2' });
    expect(singleRes.status).toBe(200);
    expect(singleRes.body.title).toBe('Single v2');
    expectNoClaimData(singleRes.body);

    // Dropping below the claimed total used to return a warning with the count.
    const multiRes = await agent.put(`/api/wishlist/${multi._id}`).send({ quantity: 2 });
    expect(multiRes.status).toBe(200);
    expectNoClaimData(multiRes.body);
    expect(multiRes.body.warning).toBeUndefined();
  });

  it('hides claim data from the owner viewing their own invite link', async () => {
    const { alice, bob, charlie } = await createTestUsers();
    const wishlist = await claimedList(alice, [bob, charlie]);
    const agent = await loginAs(alice);

    const link = await agent.post(`/api/share/${wishlist._id}/invite-link`).expect(200);
    const res = await agent.get(`/api/public/invite/${link.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.viewer.isOwner).toBe(true);
    res.body.items.forEach(expectNoClaimData);
  });
});
