const crypto = require('crypto');
const Wishlist = require('../models/Wishlist');
const { projectPublicListItem } = require('./publicProjection');
const { stripItemClaims } = require('./sanitize');
const { NotFoundError, ValidationError, UnauthorizedError } = require('./errors');

async function findOwnedList(userId, listId) {
  const wishlist = await Wishlist.findOne({ _id: listId, user: userId });
  if (!wishlist) {
    throw new NotFoundError('List not found');
  }
  return wishlist;
}

async function getInviteLink({ userId, listId }) {
  const wishlist = await findOwnedList(userId, listId);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
  return {
    enabled: wishlist.inviteLinkEnabled,
    token: wishlist.inviteToken || null,
    link: wishlist.inviteToken ? `${frontendUrl}/invite/${wishlist.inviteToken}` : null,
    allowAnonymousClaims: wishlist.allowAnonymousClaims
  };
}

// Generate or regenerate. A new token invalidates the previous link.
async function createInviteLink({ userId, listId }) {
  const wishlist = await findOwnedList(userId, listId);

  wishlist.inviteToken = crypto.randomBytes(32).toString('hex');
  wishlist.inviteLinkEnabled = true;
  await wishlist.save();

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
  return {
    token: wishlist.inviteToken,
    link: `${frontendUrl}/invite/${wishlist.inviteToken}`
  };
}

async function disableInviteLink({ userId, listId }) {
  const wishlist = await findOwnedList(userId, listId);

  wishlist.inviteLinkEnabled = false;
  await wishlist.save();

  return { message: 'Invite link disabled' };
}

async function setAnonymousClaims({ userId, listId, allow }) {
  const wishlist = await findOwnedList(userId, listId);

  wishlist.allowAnonymousClaims = !!allow;
  await wishlist.save();

  return { allowAnonymousClaims: wishlist.allowAnonymousClaims };
}

// Public view of a list via invite token. `userId` is null when the visitor
// is not signed in.
async function viewInvite({ token, userId }) {
  const wishlist = await Wishlist.findOne({
    inviteToken: token,
    inviteLinkEnabled: true
  })
    .populate('user', 'name picture')
    .populate('items.status.claimedBy', 'name picture')
    .populate('items.claims.claimedBy', 'name picture');

  if (!wishlist) {
    throw new NotFoundError('Invite link not found or disabled');
  }

  const isAuthenticated = !!userId;
  const currentUserId = isAuthenticated ? userId.toString() : null;
  const isOwner = currentUserId && wishlist.user._id.toString() === currentUserId;
  const isSharedWith = currentUserId && wishlist.sharedWith.some(
    id => id.toString() === currentUserId
  );

  return {
    list: {
      _id: wishlist._id,
      name: wishlist.name,
      description: wishlist.description,
      event_date: wishlist.event_date,
      mailingAddress: wishlist.mailingAddress,
      owner: {
        name: wishlist.user.name,
        picture: wishlist.user.picture
      },
      allowAnonymousClaims: wishlist.allowAnonymousClaims
    },
    // An owner opening their own invite link must not see claims.
    items: wishlist.items.map(item => {
      const projected = projectPublicListItem(item);
      return isOwner ? stripItemClaims(projected) : projected;
    }),
    viewer: {
      isAuthenticated,
      isOwner,
      isSharedWith
    }
  };
}

async function joinInvite({ token, userId }) {
  if (!userId) {
    throw new UnauthorizedError('Sign in to join this list');
  }

  const wishlist = await Wishlist.findOne({
    inviteToken: token,
    inviteLinkEnabled: true
  });

  if (!wishlist) {
    throw new NotFoundError('Invite link not found or disabled');
  }

  if (wishlist.user.toString() === userId.toString()) {
    throw new ValidationError('You own this list');
  }

  const alreadyShared = wishlist.sharedWith.some(
    id => id.toString() === userId.toString()
  );

  if (!alreadyShared) {
    wishlist.sharedWith.push(userId);
    await wishlist.save();
  }

  return { message: 'Successfully joined list', listId: wishlist._id };
}

module.exports = {
  getInviteLink,
  createInviteLink,
  disableInviteLink,
  setAnonymousClaims,
  viewInvite,
  joinInvite
};
