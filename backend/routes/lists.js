const express = require('express');
const router = express.Router();
const List = require('../models/List');
const WishlistItem = require('../models/WishlistItem');
const SharedList = require('../models/SharedList');

// Get all lists for current user
router.get('/', async (req, res) => {
  try {
    const lists = await List.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(lists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new list
router.post('/', async (req, res) => {
  try {
    const list = new List({
      ...req.body,
      user: req.user._id
    });
    const newList = await list.save();
    res.status(201).json(newList);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get list and its items
router.get('/:id', async (req, res) => {
  try {
    let list;
    let isShared = false;
    
    // Check if user owns the list
    list = await List.findOne({ 
      _id: req.params.id,
      user: req.user._id
    }).populate('user', 'name email picture');

    if (list) {
      // For owned lists, set owner to the user info
      list = list.toObject(); // Convert to plain object
      list.owner = {
        _id: list.user._id,
        name: list.user.name,
        email: list.user.email,
        picture: list.user.picture
      };
    } else {
      // If not found, check if it's shared with the user
      const sharedList = await SharedList.findOne({
        list: req.params.id,
        sharedWith: req.user._id
      }).populate({
        path: 'list',
        populate: {
          path: 'user',
          select: 'name email picture'
        }
      });

      if (sharedList) {
        list = sharedList.list.toObject(); // Convert to plain object
        list.owner = {
          _id: list.user._id,
          name: list.user.name,
          email: list.user.email,
          picture: list.user.picture
        };
        isShared = true;
      }
    }

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Get items for the list
    const items = await WishlistItem.find({ list: req.params.id });

    // Only log if there's an issue
    if (!list || !items) {
      console.log('Warning: Missing data:', { list: !!list, items: !!items });
    }

    res.json({
      list,
      items,
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
    console.log('Update request received:', {
      listId: req.params.id,
      userId: req.user._id,
      updates: req.body
    });

    const list = await List.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Update list fields
    list.name = req.body.name;
    list.description = req.body.description;

    const updatedList = await list.save();
    console.log('List updated:', updatedList);
    
    res.json(updatedList);
  } catch (error) {
    console.error('Error updating list:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete list (only if not default)
router.delete('/:listId', async (req, res) => {
  try {
    const list = await List.findOne({ 
      _id: req.params.listId, 
      user: req.user._id 
    });
    
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    if (list.isDefault) {
      return res.status(400).json({ 
        message: 'Cannot delete default list' 
      });
    }

    // Get default list for moving items
    const defaultList = await List.findOne({ 
      user: req.user._id, 
      isDefault: true 
    });

    // Move items to default list
    await WishlistItem.updateMany(
      { list: list._id },
      { list: defaultList._id }
    );

    await list.deleteOne();
    res.json({ message: 'List deleted, items moved to default list' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 