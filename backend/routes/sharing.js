const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const { sendEmail, getShareInviteEmail } = require('../utils/emailService');
const ActivityLog = require('../models/ActivityLog');

// Share a list with a user
router.post('/share/:listId', async (req, res) => {
  try {
    const { email } = req.body;
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    let userToShare = await User.findOne({ email: email.toLowerCase() });

    if (!userToShare) {
      // Create a placeholder user instead of a pending share
      userToShare = new User({
        email: email.toLowerCase(),
        isPending: true
      });
      await userToShare.save();
    }

    // Prevent sharing with self
    if (userToShare._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }

    // Check if already shared
    if (wishlist.sharedWith.includes(userToShare._id)) {
      return res.status(400).json({ message: 'List already shared with this user' });
    }

    // Add user to sharedWith array
    wishlist.sharedWith.push(userToShare._id);
    await wishlist.save();

    // Send email
    const inviteLink = `${process.env.FRONTEND_URL}/login`;
    const emailData = getShareInviteEmail({
      list: wishlist,
      senderName: req.user.name,
      email,
      inviteLink
    });
    await sendEmail(emailData);

    // Return user info with pending status
    res.json({
      id: userToShare._id,
      email: userToShare.email,
      isPending: userToShare.isPending,
      createdAt: userToShare.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get shared users
router.get('/share/:listId/shared-with', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    }).populate('sharedWith', 'name email picture isPending');

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
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

    const sharedUsers = wishlist.sharedWith.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      isPending: user.isPending,
      lastViewed: viewTimeMap[user._id.toString()] || null
    }));

    res.json(sharedUsers);
  } catch (error) {
    console.error('Error getting shared users:', error);
    res.status(500).json({ message: error.message });
  }
});

// Unshare
router.delete('/share/:listId/unshare/:userId', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    wishlist.sharedWith = wishlist.sharedWith.filter(
      id => id.toString() !== req.params.userId
    );
    await wishlist.save();

    res.json({ message: 'Share removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get lists shared with current user
router.get('/share/shared-with-me', async (req, res) => {
  try {
    const sharedLists = await Wishlist.find({
      sharedWith: req.user._id
    })
    .populate('user', 'name email picture')
    .sort({ createdAt: -1 });

    // Filter out lists where the owner no longer exists and format the response
    const lists = sharedLists
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
        items: list.items,
        sharedAt: list.createdAt
      }));

    res.json(lists);
  } catch (error) {
    console.error('Error fetching shared lists:', error);
    res.status(500).json({ message: error.message });
  }
});

// Claim/unclaim an item in a shared list
router.post('/share/claim/:listId/:itemId', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.listId,
      sharedWith: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found or not shared with you' });
    }

    const item = wishlist.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // If item is already claimed by someone else, prevent claiming
    if (item.status?.claimedBy && item.status.claimedBy.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'Item already claimed by someone else' });
    }

    // Toggle claim status
    if (item.status?.claimedBy?.toString() === req.user._id.toString()) {
      // Unclaim
      item.status = {};
    } else {
      // Claim
      item.status = {
        claimedBy: req.user._id,
        claimedAt: new Date()
      };
    }

    await wishlist.save();
    
    // Fetch the updated wishlist with populated claimer info
    const updatedWishlist = await Wishlist.findById(wishlist._id)
      .populate('items.status.claimedBy', 'name email picture');
    
    // Find and return the updated item
    const updatedItem = updatedWishlist.items.id(item._id);
    res.json(updatedItem);
  } catch (error) {
    console.error('Error claiming/unclaiming item:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 