const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const ActivityLog = require('../models/ActivityLog');
const { sendEmail, getShareInviteEmail } = require('../utils/emailService');
const { normalizeItem } = require('../utils/itemClaims');
const { NotFoundError, ValidationError } = require('./errors');

// Basic RFC-5322-ish email validation. Catches obvious typos without
// pretending to be a real address verifier.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Share a list with a user by email. Unknown emails get a placeholder
// (isPending) user that is converted when they sign up.
async function shareList({ userId, listId, email: rawInput, notify = true }) {
  const rawEmail = typeof rawInput === 'string' ? rawInput.trim() : '';
  if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
    throw new ValidationError('A valid email address is required');
  }
  const email = rawEmail.toLowerCase();

  const wishlist = await Wishlist.findOne({ _id: listId, user: userId });
  if (!wishlist) {
    throw new NotFoundError('List not found');
  }

  let userToShare = await User.findOne({ email });

  if (!userToShare) {
    // Create a placeholder user instead of a pending share
    userToShare = new User({
      email,
      isPending: true
    });
    await userToShare.save();
  }

  // Prevent sharing with self
  if (userToShare._id.toString() === userId.toString()) {
    throw new ValidationError('Cannot share with yourself');
  }

  // Check if already shared
  if (wishlist.sharedWith.includes(userToShare._id)) {
    throw new ValidationError('List already shared with this user');
  }

  // Add user to sharedWith array
  wishlist.sharedWith.push(userToShare._id);
  await wishlist.save();

  // Send email (callers can pass notify: false to skip it)
  if (notify) {
    const sender = await User.findById(userId);
    const inviteLink = `${process.env.FRONTEND_URL}/login`;
    const emailData = getShareInviteEmail({
      list: wishlist,
      senderName: sender && sender.name,
      email,
      inviteLink
    });
    await sendEmail(emailData);
  }

  // Return user info with pending status
  return {
    id: userToShare._id,
    email: userToShare.email,
    isPending: userToShare.isPending,
    createdAt: userToShare.createdAt
  };
}

async function listSharedWith({ userId, listId }) {
  const wishlist = await Wishlist.findOne({
    _id: listId,
    user: userId
  }).populate('sharedWith', 'name email picture isPending');

  if (!wishlist) {
    throw new NotFoundError('List not found');
  }

  // Get the latest view time for each shared user
  const viewTimes = await ActivityLog.aggregate([
    {
      $match: {
        action: 'view_list',
        wishlist: wishlist._id,
        causer: { $in: wishlist.sharedWith.map(user => user._id) }
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$causer',
        lastViewed: { $first: '$createdAt' }
      }
    }
  ]);

  // Create a map of user IDs to their last view time
  const viewTimeMap = viewTimes.reduce((acc, view) => {
    acc[view._id.toString()] = view.lastViewed;
    return acc;
  }, {});

  return wishlist.sharedWith.map(user => ({
    id: user._id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    isPending: user.isPending,
    lastViewed: viewTimeMap[user._id.toString()] || null
  }));
}

// Removes the user from sharedWith. Their existing claims are left in place.
async function unshareList({ userId, listId, targetUserId }) {
  const wishlist = await Wishlist.findOne({ _id: listId, user: userId });
  if (!wishlist) {
    throw new NotFoundError('List not found');
  }

  wishlist.sharedWith = wishlist.sharedWith.filter(
    id => id.toString() !== targetUserId
  );
  await wishlist.save();

  return { message: 'Share removed successfully' };
}

async function listSharedWithMe({ userId }) {
  const sharedLists = await Wishlist.find({ sharedWith: userId })
    .populate('user', 'name email picture')
    .populate('items.status.claimedBy', 'name email picture')
    .populate('items.claims.claimedBy', 'name email picture')
    .sort({ createdAt: -1 });

  // Filter out lists where the owner no longer exists and format the response
  return sharedLists
    .filter(list => list.user) // Only include lists where the owner still exists
    .map(list => ({
      _id: list._id,
      name: list.name,
      description: list.description,
      event_date: list.event_date,
      owner: {
        _id: list.user._id,
        name: list.user.name,
        email: list.user.email,
        picture: list.user.picture
      },
      items: list.items.map(normalizeItem),
      sharedAt: list.createdAt,
      isArchived: list.isArchived,
      archiveDate: list.archiveDate
    }));
}

module.exports = { shareList, listSharedWith, unshareList, listSharedWithMe };
