const express = require('express');
const router = express.Router();
const SharedList = require('../models/SharedList');
const User = require('../models/User');
const WishlistItem = require('../models/WishlistItem');
const ItemStatus = require('../models/ItemStatus');
const PendingShare = require('../models/PendingShare');

// Share list with a user
router.post('/share', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Sharing request:', { email, currentUser: req.user._id });
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Prevent sharing with self
    if (email.toLowerCase() === req.user.email.toLowerCase()) {
      console.log('Attempted to share with self');
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }

    // Find user by email
    const userToShare = await User.findOne({ email: email.toLowerCase() });
    
    if (userToShare) {
      // Check if already shared
      const existingShare = await SharedList.findOne({
        owner: req.user._id,
        sharedWith: userToShare._id
      });

      if (existingShare) {
        return res.status(400).json({ message: 'List already shared with this user' });
      }

      // User exists - create direct share
      const shareDoc = await SharedList.create({
        owner: req.user._id,
        sharedWith: userToShare._id
      });
      console.log('Share created:', shareDoc);
      res.status(201).json({ message: 'List shared successfully' });
    } else {
      // Check if already pending
      const existingPending = await PendingShare.findOne({
        owner: req.user._id,
        email: email.toLowerCase()
      });

      if (existingPending) {
        return res.status(400).json({ message: 'Share already pending for this email' });
      }

      // User doesn't exist - create pending share
      await PendingShare.create({
        owner: req.user._id,
        email: email.toLowerCase()
      });
      res.status(201).json({ 
        message: 'Share pending. They will get access when they sign up!'
      });
    }
  } catch (error) {
    console.error('Share error:', error);
    if (error.code === 11000) { // Duplicate key error
      return res.status(400).json({ 
        message: 'List is already shared or pending with this user' 
      });
    }
    res.status(500).json({ message: 'Error sharing list. Please try again.' });
  }
});

// Get lists shared with me
router.get('/shared-with-me', async (req, res) => {
  try {
    const sharedLists = await SharedList.find({ sharedWith: req.user._id })
      .populate('owner', 'name email picture');
    
    // Get items for each shared list
    const sharedItems = await Promise.all(
      sharedLists.map(async (share) => {
        const items = await WishlistItem.find({ user: share.owner });
        return {
          owner: share.owner,
          items: items
        };
      })
    );

    res.json(sharedItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get users I've shared my list with
router.get('/shared-with', async (req, res) => {
  try {
    const shares = await SharedList.find({ owner: req.user._id })
      .populate('sharedWith', 'name email picture');
    res.json(shares);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove share
router.delete('/unshare/:userId', async (req, res) => {
  try {
    await SharedList.findOneAndDelete({
      owner: req.user._id,
      sharedWith: req.params.userId
    });
    res.json({ message: 'Sharing removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add this route to your sharing.js
router.get('/shared-list/:userId', async (req, res) => {
  try {
    console.log('Fetching shared list:', {
      requestedUserId: req.params.userId,
      currentUser: req.user._id
    });

    const owner = await User.findById(req.params.userId);
    if (!owner) {
      console.log('Owner not found');
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify the list is shared with the requesting user
    const shareExists = await SharedList.findOne({
      owner: req.params.userId,
      sharedWith: req.user._id
    });

    console.log('Share relationship:', shareExists);

    if (!shareExists) {
      console.log('Share relationship not found');
      return res.status(403).json({ message: 'Not authorized to view this list' });
    }

    const items = await WishlistItem.find({ user: req.params.userId });
    console.log(`Found ${items.length} items`);
    
    // Get status for all items
    const statuses = await ItemStatus.find({
      item: { $in: items.map(item => item._id) },
      owner: req.params.userId
    }).populate('user', 'name picture');

    // Create a map of item statuses
    const statusMap = statuses.reduce((acc, status) => {
      if (!acc[status.item]) {
        acc[status.item] = [];
      }
      acc[status.item].push(status);
      return acc;
    }, {});

    const itemsWithStatus = items.map(item => ({
      ...item.toObject(),
      statuses: statusMap[item._id] || []
    }));

    res.json({
      owner,
      items: itemsWithStatus
    });
  } catch (error) {
    console.error('Error in shared-list route:', error);
    res.status(500).json({ 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Set item status (purchased/tentative)
router.post('/item-status/:itemId', async (req, res) => {
  try {
    const { status } = req.body;
    const itemId = req.params.itemId;

    // Get the item to verify ownership
    const item = await WishlistItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Verify the list is shared with the requesting user
    const shareExists = await SharedList.findOne({
      owner: item.user,
      sharedWith: req.user._id
    });

    if (!shareExists) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create or update status
    const itemStatus = await ItemStatus.findOneAndUpdate(
      { item: itemId, user: req.user._id },
      { 
        status,
        owner: item.user,
        item: itemId,
        user: req.user._id
      },
      { upsert: true, new: true }
    );

    await itemStatus.populate('user', 'name picture');

    const io = req.app.get('io');
    
    // Emit to the item owner
    io.to(`user_${item.user}`).emit('itemStatusUpdated', {
      itemId: item._id,
      status: itemStatus
    });

    // Emit to all users who have this item shared with them
    const sharedUsers = await SharedList.find({ owner: item.user });
    sharedUsers.forEach(share => {
      io.to(`user_${share.sharedWith}`).emit('itemStatusUpdated', {
        itemId: item._id,
        status: itemStatus
      });
    });

    res.json(itemStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove item status
router.delete('/item-status/:itemId', async (req, res) => {
  try {
    await ItemStatus.findOneAndDelete({
      item: req.params.itemId,
      user: req.user._id
    });
    res.json({ message: 'Status removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

module.exports = router; 