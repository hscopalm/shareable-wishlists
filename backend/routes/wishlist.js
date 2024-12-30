const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');

// Create item
router.post('/', async (req, res) => {
  try {
    const { list: listId, ...itemData } = req.body;
    
    const wishlist = await Wishlist.findOne({
      _id: listId,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'List not found' });
    }

    wishlist.items.push({
      ...itemData,
      createdAt: new Date()
    });

    await wishlist.save();
    res.status(201).json(wishlist.items[wishlist.items.length - 1]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update item
router.put('/:id', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      'items._id': req.params.id,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const itemIndex = wishlist.items.findIndex(
      item => item._id.toString() === req.params.id
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Update the item
    wishlist.items[itemIndex] = {
      ...wishlist.items[itemIndex].toObject(),
      ...req.body
    };

    await wishlist.save();
    res.json(wishlist.items[itemIndex]);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete item
router.delete('/:id', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      'items._id': req.params.id,
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'Item not found' });
    }

    wishlist.items = wishlist.items.filter(
      item => item._id.toString() !== req.params.id
    );

    await wishlist.save();
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 