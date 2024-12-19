const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  link: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    required: false
  },
  notes: {
    type: String,
    required: false
  },
  price: {
    type: Number,
    required: false,
    min: 0
  },
  priority: {
    type: Number,
    default: 3,
    min: 1,
    max: 5
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('WishlistItem', wishlistItemSchema); 