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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure a user can't share their list multiple times with the same person
sharedListSchema.index({ owner: 1, sharedWith: 1 }, { unique: true });

module.exports = mongoose.model('SharedList', sharedListSchema); 