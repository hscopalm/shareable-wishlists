const mongoose = require('mongoose');

const sharedListSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sharedWith: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  list: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'List',
    required: true
  },
  lastViewed: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create a compound unique index for list + sharedWith
sharedListSchema.index({ list: 1, sharedWith: 1 }, { unique: true });

const SharedList = mongoose.model('SharedList', sharedListSchema);

module.exports = SharedList; 