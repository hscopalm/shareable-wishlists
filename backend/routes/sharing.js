const express = require('express');
const router = express.Router();
const User = require('../models/User');
const List = require('../models/List');
const WishlistItem = require('../models/WishlistItem');
const SharedList = require('../models/SharedList');
const ListView = require('../models/ListView');
const PendingShare = require('../models/PendingShare');
const { sendEmail, getShareInviteEmail } = require('../utils/emailService');

// Share a list with a user
router.post('/share/:listId', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Share request:', { listId: req.params.listId, email });

    const list = await List.findOne({ 
      _id: req.params.listId,
      user: req.user._id
    }).populate('user', 'name email picture');

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Find user by email
    const userToShare = await User.findOne({ email: email.toLowerCase() });
    
    if (!userToShare) {
      // Create a pending share instead of returning 404
      const pendingShare = new PendingShare({
        owner: req.user._id,
        email: email.toLowerCase(),
        list: list._id
      });
      await pendingShare.save();

      // Send invitation email
      const inviteLink = `${process.env.FRONTEND_URL}/login`;
      const emailData = getShareInviteEmail({
        list,
        senderName: req.user.name,
        email: email,
        inviteLink
      });
      
      await sendEmail(emailData);

      // Return pending share info
      return res.json({
        id: pendingShare._id,
        email: email,
        isPending: true,
        createdAt: pendingShare.createdAt
      });
    }

    // Prevent sharing with self
    if (userToShare._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }

    // Check if already shared
    const existingShare = await SharedList.findOne({
      owner: req.user._id,
      sharedWith: userToShare._id,
      list: list._id
    });

    if (existingShare) {
      return res.status(400).json({ message: 'List already shared with this user' });
    }

    // Create SharedList record
    const sharedList = new SharedList({
      owner: req.user._id,
      sharedWith: userToShare._id,
      list: list._id
    });
    await sharedList.save();

    // Send email with enhanced list details
    const inviteLink = `${process.env.FRONTEND_URL}/list/${list._id}`;
    
    // Fix: Pass an object with the required properties
    const emailData = getShareInviteEmail({
      list,
      senderName: req.user.name,
      email: email,
      inviteLink
    });
    
    await sendEmail(emailData);

    // Return the shared user info
    res.json({
      id: userToShare._id,
      name: userToShare.name,
      email: userToShare.email,
      picture: userToShare.picture,
      isPending: false,
      createdAt: sharedList.createdAt
    });

  } catch (error) {
    console.error('Error sharing list:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get users who have access to a list
router.get('/share/:listId/shared-with', async (req, res) => {
  try {
    // First verify the user owns this list
    const list = await List.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Get all SharedList records for this list
    const sharedLists = await SharedList.find({ 
      list: list._id,
      owner: req.user._id
    })
    .populate('sharedWith', 'name email picture')
    .sort({ createdAt: -1 });

    // Get pending shares
    const pendingShares = await PendingShare.find({
      list: list._id,
      owner: req.user._id
    }).sort({ createdAt: -1 });

    // Format the response
    const sharedUsers = [
      ...sharedLists.map(share => ({
        id: share.sharedWith._id,
        name: share.sharedWith.name,
        email: share.sharedWith.email,
        picture: share.sharedWith.picture,
        lastViewed: share.lastViewed,
        sharedAt: share.createdAt,
        isPending: false
      })),
      ...pendingShares.map(share => ({
        id: share._id,
        email: share.email,
        sharedAt: share.createdAt,
        isPending: true
      }))
    ];

    res.json(sharedUsers);
  } catch (error) {
    console.error('Error getting shared users:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get lists shared with current user
router.get('/share/shared-with-me', async (req, res) => {
  try {
    const sharedLists = await SharedList.find({
      sharedWith: req.user._id
    })
    .populate({
      path: 'list',
      select: 'name description createdAt',
    })
    .populate({
      path: 'owner',
      select: 'name email picture'
    });

    // Format the response
    const lists = sharedLists.map(share => ({
      _id: share.list._id,
      name: share.list.name,
      description: share.list.description,
      owner: {
        _id: share.owner._id,
        name: share.owner.name,
        email: share.owner.email,
        picture: share.owner.picture
      },
      sharedAt: share.createdAt,
      lastViewed: share.lastViewed
    }));

    res.json(lists);
  } catch (error) {
    console.error('Error fetching shared lists:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get lists shared with current user
router.get('/shared-with-me', async (req, res) => {
  try {
    // Find all items shared with the current user
    const sharedItems = await WishlistItem.find({
      sharedWith: req.user._id
    }).populate('list', 'name user');

    // Group items by list
    const listMap = new Map();
    sharedItems.forEach(item => {
      if (!listMap.has(item.list._id.toString())) {
        listMap.set(item.list._id.toString(), {
          _id: item.list._id,
          name: item.list.name,
          user: item.list.user,
          items: []
        });
      }
      listMap.get(item.list._id.toString()).items.push(item);
    });

    res.json(Array.from(listMap.values()));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get users I've shared my list with
router.get('/shared-with', async (req, res) => {
  try {
    // Get active shares
    const activeShares = await SharedList.find({ owner: req.user._id })
      .populate('sharedWith', 'name email picture');

    // Get pending shares
    const pendingShares = await PendingShare.find({ owner: req.user._id });

    // Get last viewed timestamps
    const views = await ListView.find({
      owner: req.user._id
    });

    // Create a map of last viewed times
    const viewMap = views.reduce((acc, view) => {
      acc[view.user.toString()] = view.lastViewed;
      return acc;
    }, {});

    // Combine and format the shares
    const allShares = [
      ...activeShares.map(share => ({
        id: share.sharedWith._id,
        name: share.sharedWith.name,
        email: share.sharedWith.email,
        picture: share.sharedWith.picture,
        isPending: false,
        lastViewed: viewMap[share.sharedWith._id] || null
      })),
      ...pendingShares.map(pending => ({
        id: pending._id,
        email: pending.email,
        isPending: true,
        createdAt: pending.createdAt,
        lastViewed: null
      }))
    ];

    res.json(allShares);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove share
router.delete('/unshare/:listId/:userId', async (req, res) => {
  try {
    const { listId, userId } = req.params;

    // Verify list ownership
    const list = await List.findOne({
      _id: listId,
      user: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Remove user from sharedWith array for all items in the list
    await WishlistItem.updateMany(
      { list: listId },
      { $pull: { sharedWith: userId } }
    );

    // Remove SharedList record
    await SharedList.findOneAndDelete({
      owner: req.user._id,
      sharedWith: userId,
      list: listId
    });

    res.json({ message: 'Sharing removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add this route to your sharing.js
router.get('/shared-list/:userId', async (req, res) => {
  try {
    const owner = await User.findById(req.params.userId)
      .select('name email picture');

    if (!owner) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get all lists for the owner
    const lists = await List.find({ user: owner._id });
    const listIds = lists.map(list => list._id);

    // Get all items from all lists
    const items = await WishlistItem.find({ 
      list: { $in: listIds } 
    }).populate('list', 'name');

    // Update last viewed timestamp
    await ListView.findOneAndUpdate(
      { user: req.user._id, owner: req.params.userId },
      { lastViewed: new Date() },
      { upsert: true }
    );

    res.json({
      owner,
      items
    });
  } catch (error) {
    console.error('Error in shared-list route:', error);
    res.status(500).json({ 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add route to check pending shares
router.get('/pending-shares', async (req, res) => {
  try {
    const pendingShares = await PendingShare.find({ owner: req.user._id })
      .select('email createdAt');
    res.json(pendingShares);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add route to remove pending share
router.delete('/pending-share/:email', async (req, res) => {
  try {
    await PendingShare.findOneAndDelete({
      owner: req.user._id,
      email: req.params.email.toLowerCase()
    });
    res.json({ message: 'Pending share removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update last viewed timestamp
router.post('/share/:listId/view', async (req, res) => {
  try {
    const listId = req.params.listId;
    const userId = req.user._id;
    
    // Find the share record first
    const share = await SharedList.findOne({
      list: listId,
      sharedWith: userId
    }).populate('owner');

    if (!share) {
      return res.status(404).json({ message: 'Share record not found' });
    }

    // Update SharedList record
    share.lastViewed = new Date();
    await share.save();

    // Update or create ListView record
    const listView = await ListView.findOneAndUpdate(
      {
        user: userId,
        list: listId,
        owner: share.owner._id
      },
      {
        lastViewed: new Date()
      },
      {
        upsert: true,
        new: true
      }
    );

    res.json({ 
      success: true, 
      lastViewed: share.lastViewed,
      listView: listView 
    });
  } catch (error) {
    console.error('Error updating last viewed:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add this route to handle unsharing
router.delete('/share/:listId/unshare/:userId', async (req, res) => {
  try {
    const { listId, userId } = req.params;

    // Verify the list exists and user owns it
    const list = await List.findOne({
      _id: listId,
      user: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Find and delete the share record
    const shareRecord = await SharedList.findOneAndDelete({
      list: listId,
      owner: req.user._id,
      sharedWith: userId
    });

    if (!shareRecord) {
      return res.status(404).json({ message: 'Share record not found' });
    }

    // Also delete any associated list views
    await ListView.deleteMany({
      list: listId,
      user: userId
    });

    res.json({ message: 'Share removed successfully' });
  } catch (error) {
    console.error('Error removing share:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 