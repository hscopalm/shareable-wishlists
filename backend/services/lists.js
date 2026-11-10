const Wishlist = require('../models/Wishlist');
const ActivityLog = require('../models/ActivityLog');
const { normalizeItem } = require('../utils/itemClaims');
const { NotFoundError } = require('./errors');

async function listLists({ userId }) {
  // Tiebreak on _id so two lists created in the same millisecond
  // still sort deterministically by insertion order.
  return Wishlist.find({ user: userId }).sort({ createdAt: -1, _id: -1 });
}

async function createList({ userId, name, description, event_date, mailingAddress }) {
  const wishlist = new Wishlist({
    name,
    description,
    event_date,
    mailingAddress,
    user: userId,
    items: []
  });
  return wishlist.save();
}

// Owner or shared user. Returns { list, items, isShared } and logs the view.
async function getList({ userId, listId }) {
  const wishlist = await Wishlist.findOne({
    $or: [
      { _id: listId, user: userId },
      { _id: listId, sharedWith: userId }
    ]
  })
  .populate('user sharedWith', 'name email picture')
  .populate('items.status.claimedBy', 'name email picture')
  .populate('items.claims.claimedBy', 'name email picture');

  if (!wishlist) {
    throw new NotFoundError('List not found');
  }

  const isShared = wishlist.user._id.toString() !== userId.toString();
  const normalizedItems = wishlist.items.map(normalizeItem);

  await ActivityLog.create({
    action: 'view_list',
    causer: userId,
    wishlist: wishlist._id,
    page: 'list_detail',
    details: {
      listName: wishlist.name,
      listOwner: wishlist.user._id,
      isShared: isShared,
      itemCount: wishlist.items.length,
      viewerRole: isShared ? 'shared_user' : 'owner'
    }
  });

  return {
    list: wishlist,
    items: normalizedItems,
    isShared
  };
}

async function updateList({ userId, listId, name, description, event_date, mailingAddress }) {
  const wishlist = await Wishlist.findOne({ _id: listId, user: userId });
  if (!wishlist) {
    throw new NotFoundError('List not found');
  }

  wishlist.name = name;
  wishlist.description = description;
  wishlist.event_date = event_date;
  wishlist.mailingAddress = mailingAddress;

  return wishlist.save();
}

async function deleteList({ userId, listId }) {
  const wishlist = await Wishlist.findOneAndDelete({ _id: listId, user: userId });
  if (!wishlist) {
    throw new NotFoundError('List not found');
  }
  return { message: 'List deleted successfully' };
}

module.exports = { listLists, createList, getList, updateList, deleteList };
