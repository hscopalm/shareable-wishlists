const mongoose = require('mongoose');

const pendingShareSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60 // Auto-delete after 30 days if unclaimed
  }
});

pendingShareSchema.index({ email: 1, owner: 1 }, { unique: true });

module.exports = mongoose.model('PendingShare', pendingShareSchema); 