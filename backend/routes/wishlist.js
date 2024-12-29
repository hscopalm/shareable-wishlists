const express = require('express');
const router = express.Router();
const WishlistItem = require('../models/WishlistItem');
const List = require('../models/List');

// Get all items (from all lists)
router.get('/', async (req, res) => {
  try {
    // Get all lists owned by user
    const lists = await List.find({ user: req.user._id });
    const listIds = lists.map(list => list._id);
    
    // Get shared items
    const sharedItems = await WishlistItem.find({
      sharedWith: req.user._id
    }).populate('list', 'name');

    // Get items from user's lists
    const ownedItems = await WishlistItem.find({ 
      list: { $in: listIds } 
    }).populate('list', 'name');
    
    // Combine and sort all items
    const items = [...ownedItems, ...sharedItems].sort((a, b) => 
      b.createdAt - a.createdAt
    );
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create item (in specified list)
router.post('/', async (req, res) => {
  try {
    const { list: listId, ...itemData } = req.body;
    console.log('Creating item:', { listId, itemData, user: req.user._id });
    
    // Verify list exists and user has access
    const list = await List.findOne({
      _id: listId,
      user: req.user._id
    });

    if (!list) {
      console.log('List not found:', { listId, userId: req.user._id });
      return res.status(404).json({ message: 'List not found' });
    }

    const wishlistItem = new WishlistItem({
      ...itemData,
      list: listId,
      user: req.user._id
    });

    const savedItem = await wishlistItem.save();
    console.log('Item saved:', savedItem);
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Create item error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update item
router.put('/:id', async (req, res) => {
  try {
    // Get user's lists
    const lists = await List.find({ user: req.user._id });
    const listIds = lists.map(list => list._id);

    const item = await WishlistItem.findOne({ 
      _id: req.params.id,
      list: { $in: listIds }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // If changing lists, verify new list belongs to user
    if (req.body.list) {
      const newList = await List.findOne({ 
        _id: req.body.list, 
        user: req.user._id 
      });
      
      if (!newList) {
        return res.status(404).json({ message: 'Target list not found' });
      }
    }

    Object.assign(item, req.body);
    const updatedItem = await item.save();
    await updatedItem.populate('list', 'name');
    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete item
router.delete('/:id', async (req, res) => {
  try {
    // Get user's lists
    const lists = await List.find({ user: req.user._id });
    const listIds = lists.map(list => list._id);

    const item = await WishlistItem.findOne({ 
      _id: req.params.id,
      list: { $in: listIds }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    await item.deleteOne();
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 