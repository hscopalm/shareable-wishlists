const express = require('express');
const router = express.Router();
const WishlistItem = require('../models/WishlistItem');

// Get all wishlist items
router.get('/', async (req, res) => {
  try {
    const items = await WishlistItem.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new wishlist item
router.post('/', async (req, res) => {
  const item = new WishlistItem(req.body);
  try {
    const newItem = await item.save();
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a wishlist item
router.put('/:id', async (req, res) => {
  try {
    const item = await WishlistItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    
    // Ensure price is properly handled
    const updateData = {
      ...req.body,
      price: req.body.price !== undefined ? parseFloat(req.body.price) : undefined
    };
    
    Object.assign(item, updateData);
    const updatedItem = await item.save();
    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a wishlist item
router.delete('/:id', async (req, res) => {
  try {
    const item = await WishlistItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    
    await item.deleteOne();
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 