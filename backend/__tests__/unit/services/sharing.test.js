const User = require('../../../models/User');
const Wishlist = require('../../../models/Wishlist');
const { createUser } = require('../../fixtures/users');
const { createWishlist } = require('../../fixtures/wishlists');
const sharing = require('../../../services/sharing');
const lists = require('../../../services/lists');
const { claimItem } = require('../../../services/claims');
const { NotFoundError, ValidationError } = require('../../../services/errors');

describe('shareList', () => {
  it('only the owner can share; others get NotFound', async () => {
    const owner = await createUser();
    const other = await createUser();
    const list = await createWishlist(owner);
    await expect(sharing.shareList({ userId: other._id, listId: list._id, email: 'x@test.com' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects bad emails, self-share and duplicates', async () => {
    const owner = await createUser({ email: 'owner@test.com' });
    const bob = await createUser({ email: 'bob@test.com' });
    const list = await createWishlist(owner);
    const share = email => sharing.shareList({ userId: owner._id, listId: list._id, email });

    await expect(share('nope')).rejects.toMatchObject({ status: 400 });
    await expect(share(undefined)).rejects.toBeInstanceOf(ValidationError);
    await expect(share('OWNER@test.com')).rejects.toMatchObject({ message: 'Cannot share with yourself' });
    await share('bob@test.com');
    await expect(share(' Bob@Test.com ')).rejects.toMatchObject({ message: 'List already shared with this user' });
    expect((await Wishlist.findById(list._id)).sharedWith).toHaveLength(1);
  });

  it('shares with a pending user who keeps access after signing up', async () => {
    const owner = await createUser();
    const list = await createWishlist(owner, { items: [{ title: 'Book' }] });
    const res = await sharing.shareList({ userId: owner._id, listId: list._id, email: 'new@test.com' });
    expect(res.isPending).toBe(true);

    // Same update the OAuth callback applies on first sign-in.
    const user = await User.findById(res.id);
    Object.assign(user, { googleId: 'g-1', name: 'New Person', isPending: false });
    await user.save();

    const view = await lists.getList({ userId: user._id, listId: list._id });
    expect(view.isShared).toBe(true);
    const mine = await sharing.listSharedWithMe({ userId: user._id });
    expect(mine).toHaveLength(1);
    const claimed = await claimItem({
      userId: user._id, listId: list._id, itemId: list.items[0]._id
    });
    expect(claimed.claims).toHaveLength(1);
  });
});

describe('unshareList', () => {
  it('removes access to the list for that user only', async () => {
    const owner = await createUser();
    const bob = await createUser();
    const carol = await createUser();
    const list = await createWishlist(owner, { sharedWith: [bob._id, carol._id] });

    await sharing.unshareList({ userId: owner._id, listId: list._id, targetUserId: bob._id.toString() });

    await expect(lists.getList({ userId: bob._id, listId: list._id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(lists.getList({ userId: carol._id, listId: list._id })).resolves.toBeTruthy();
    expect(await sharing.listSharedWithMe({ userId: bob._id })).toHaveLength(0);
  });

  it('shared users cannot unshare', async () => {
    const owner = await createUser();
    const bob = await createUser();
    const list = await createWishlist(owner, { sharedWith: [bob._id] });
    await expect(sharing.unshareList({ userId: bob._id, listId: list._id, targetUserId: bob._id.toString() }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('listSharedWith', () => {
  it('reports last viewed time from view_list activity', async () => {
    const owner = await createUser();
    const bob = await createUser();
    const list = await createWishlist(owner, { sharedWith: [bob._id] });
    expect((await sharing.listSharedWith({ userId: owner._id, listId: list._id }))[0].lastViewed).toBeNull();
    await lists.getList({ userId: bob._id, listId: list._id });
    expect((await sharing.listSharedWith({ userId: owner._id, listId: list._id }))[0].lastViewed).toBeInstanceOf(Date);
  });
});
