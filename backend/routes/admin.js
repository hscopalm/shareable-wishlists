const express = require('express');
const router = express.Router();
const User = require('../models/User');
const List = require('../models/List');
const WishlistItem = require('../models/WishlistItem');
const SharedList = require('../models/SharedList');
const ListView = require('../models/ListView');

// Delete user and all associated data
router.delete('/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Delete all user's lists and items
    const lists = await List.find({ user: userId });
    const listIds = lists.map(list => list._id);
    
    await WishlistItem.deleteMany({ list: { $in: listIds } });
    await List.deleteMany({ user: userId });

    // Delete sharing records
    await SharedList.deleteMany({ 
      $or: [
        { owner: userId },
        { sharedWith: userId }
      ]
    });

    // Delete view records
    await ListView.deleteMany({ 
      $or: [
        { user: userId },
        { owner: userId }
      ]
    });

    // Finally delete the user
    await User.findByIdAndDelete(userId);

    res.json({ message: 'User and all associated data deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user stats
router.get('/users/:userId/stats', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const stats = await Promise.all([
      User.findById(userId),
      List.countDocuments({ user: userId }),
      WishlistItem.countDocuments({ list: { $in: await List.find({ user: userId }).select('_id') } }),
      SharedList.countDocuments({ owner: userId }),
      SharedList.countDocuments({ sharedWith: userId }),
      ListView.countDocuments({ user: userId })
    ]);

    res.json({
      user: stats[0],
      listCount: stats[1],
      itemCount: stats[2],
      sharedByMeCount: stats[3],
      sharedWithMeCount: stats[4],
      viewCount: stats[5]
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 