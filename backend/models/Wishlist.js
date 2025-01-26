const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  event_date: {
    type: Date
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  items: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    link: String,
    imageUrl: String,
    notes: String,
    price: Number,
    priority: {
      type: Number,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    status: {
      claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      claimedAt: Date
    }
  }]
});

module.exports = mongoose.model('Wishlist', wishlistSchema); 