const mongoose = require('mongoose');

const itemStatusSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WishlistItem',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PURCHASED', 'TENTATIVE'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure a user can't mark an item twice
itemStatusSchema.index({ item: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('ItemStatus', itemStatusSchema); 