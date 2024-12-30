const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now
  },
  action: {
    type: String,
    required: true
  },
  causer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  wishlist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wishlist'
  },
  page: {
    type: String,
    required: true
  },
  details: {
    type: Object,
    required: true
  }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);