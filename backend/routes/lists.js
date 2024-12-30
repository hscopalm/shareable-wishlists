const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const ActivityLog = require('../models/ActivityLog');

// Get all lists for current user
router.get('/', async (req, res) => {
  try {
    const wishlists = await Wishlist.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    res.json(wishlists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new list
router.post('/', async (req, res) => {
  try {
    const wishlist = new Wishlist({
      name: req.body.name,
      description: req.body.description,
      user: req.user._id,
      items: []
    });
    const newWishlist = await wishlist.save();
    res.status(201).json(newWishlist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get list and its items
router.get('/:id', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      $or: [
        { _id: req.params.id, user: req.user._id },
        { _id: req.params.id, sharedWith: req.user._id }
      ]
    })
    .populate('user sharedWith', 'name email picture');

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    const isShared = wishlist.user._id.toString() !== req.user._id.toString();

    // Log the view activity
    await ActivityLog.create({
      action: 'view_list',
      causer: req.user._id,
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

    res.json({
      list: wishlist,
      items: wishlist.items,
      isShared
    });
  } catch (error) {
    console.error('Error loading list:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update list
router.put('/:id', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    wishlist.name = req.body.name;
    wishlist.description = req.body.description;

    const updatedWishlist = await wishlist.save();
    res.json(updatedWishlist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete list
router.delete('/:id', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 