const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const ActivityLog = require('../models/ActivityLog');

// Delete user and all associated data
router.delete('/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Delete all wishlists owned by the user (items are embedded, so they're deleted too)
    await Wishlist.deleteMany({ user: userId });

    // Remove user from sharedWith arrays in other wishlists
    await Wishlist.updateMany(
      { sharedWith: userId },
      { $pull: { sharedWith: userId } }
    );

    // Remove user's claims from all wishlist items
    await Wishlist.updateMany(
      { 'items.status.claimedBy': userId },
      { $set: { 'items.$[item].status': {} } },
      { arrayFilters: [{ 'item.status.claimedBy': userId }] }
    );

    // Delete activity logs where user is the causer
    await ActivityLog.deleteMany({ causer: userId });

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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get wishlists owned by user
    const ownedWishlists = await Wishlist.find({ user: userId });

    // Count total items across all owned wishlists
    const itemCount = ownedWishlists.reduce((sum, wl) => sum + (wl.items?.length || 0), 0);

    // Count wishlists shared by this user (owned and has sharedWith entries)
    const sharedByMeCount = ownedWishlists.filter(wl => wl.sharedWith?.length > 0).length;

    // Count wishlists shared with this user
    const sharedWithMeCount = await Wishlist.countDocuments({ sharedWith: userId });

    // Count activity logs for this user
    const activityCount = await ActivityLog.countDocuments({ causer: userId });

    res.json({
      user,
      listCount: ownedWishlists.length,
      itemCount,
      sharedByMeCount,
      sharedWithMeCount,
      activityCount
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
