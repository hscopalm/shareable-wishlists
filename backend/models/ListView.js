const mongoose = require('mongoose');

const listViewModel = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  list: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'List',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastViewed: {
    type: Date,
    default: Date.now
  }
});

// Create a compound unique index for user + list
listViewModel.index({ user: 1, list: 1 }, { unique: true });

module.exports = mongoose.model('ListView', listViewModel); 